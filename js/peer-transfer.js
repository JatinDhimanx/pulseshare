/**
 * Zero-DB P2P Share Transfer Engine
 * Uses WebRTC DataChannel via PeerJS for direct browser-to-browser memory transfer.
 * NO server database, NO file storage on server. Everything is held in browser RAM.
 */

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks for safe WebRTC transmission
const PEER_PREFIX = 'zdbshare-v1-';

class PeerTransferEngine {
  constructor() {
    this.peer = null;
    this.connection = null;
    this.isSender = false;
    this.activeCode = null;
    this.currentPayload = null; // { type: 'file', file: File } or { type: 'note', text: '', title: '' }
    this.transferState = 'idle'; // idle, hosting, connecting, transferring, completed, error
    this.activeReceivers = [];
    
    // Callbacks for UI updates
    this.onStatusChange = null;
    this.onProgress = null;
    this.onReceiverConnected = null;
    this.onReceiverDisconnected = null;
    this.onTransferStart = null;
    this.onTransferComplete = null;
    this.onError = null;
  }

  /**
   * Generates a clean 6-digit room code
   */
  generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Initializes host (Sender) peer with a given code
   */
  async hostSession(code, payload) {
    this.destroy(); // Clean previous state
    this.isSender = true;
    this.activeCode = code;
    this.currentPayload = payload;
    this.transferState = 'hosting';

    return new Promise((resolve, reject) => {
      const peerId = PEER_PREFIX + code;
      
      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
      } catch (err) {
        this.transferState = 'error';
        if (this.onError) this.onError(err.message || 'Failed to initialize P2P network');
        reject(err);
        return;
      }

      this.peer.on('open', (id) => {
        if (this.onStatusChange) {
          this.onStatusChange({
            state: 'hosting',
            code: this.activeCode,
            message: `Broadcasting live on code: ${this.activeCode}`
          });
        }
        resolve(code);
      });

      this.peer.on('connection', (conn) => {
        this._handleIncomingReceiver(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer host error:', err);
        if (err.type === 'unavailable-id') {
          // If code is already taken, reject so UI can try another code
          reject(new Error('This code is currently in use. Please generate a new code.'));
        } else {
          if (this.onError) this.onError(`P2P Connection Error: ${err.type || err.message}`);
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        // Attempt reconnection to signaling server if disconnected
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  /**
   * Handles an incoming receiver connection on sender side
   */
  _handleIncomingReceiver(conn) {
    const receiverId = conn.peer;
    this.activeReceivers.push(conn);

    if (this.onReceiverConnected) {
      this.onReceiverConnected({
        receiverId,
        activeCount: this.activeReceivers.length
      });
    }

    conn.on('open', () => {
      // Send metadata immediately when receiver connects
      if (this.currentPayload.type === 'file') {
        const file = this.currentPayload.file;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        conn.send({
          type: 'META',
          payloadType: 'file',
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
          chunkSize: CHUNK_SIZE
        });
      } else if (this.currentPayload.type === 'note') {
        conn.send({
          type: 'META',
          payloadType: 'note',
          title: this.currentPayload.title || 'Shared Note',
          size: new Blob([this.currentPayload.text]).size
        });
      }
    });

    conn.on('data', (data) => {
      if (data && data.type === 'READY_FOR_DATA') {
        // Receiver is ready to stream the file
        if (this.currentPayload.type === 'file') {
          this._streamFileToReceiver(conn, this.currentPayload.file);
        } else if (this.currentPayload.type === 'note') {
          conn.send({
            type: 'NOTE_CONTENT',
            title: this.currentPayload.title || 'Shared Note',
            text: this.currentPayload.text
          });
        }
      } else if (data && data.type === 'TRANSFER_SUCCESS') {
        if (this.onTransferComplete) {
          this.onTransferComplete({
            receiverId: conn.peer,
            itemName: this.currentPayload.type === 'file' ? this.currentPayload.file.name : 'Note'
          });
        }
      }
    });

    conn.on('close', () => {
      this.activeReceivers = this.activeReceivers.filter(c => c.peer !== receiverId);
      if (this.onReceiverDisconnected) {
        this.onReceiverDisconnected({
          receiverId,
          activeCount: this.activeReceivers.length
        });
      }
    });

    conn.on('error', (err) => {
      console.warn('Receiver connection error:', err);
    });
  }

  /**
   * Streams file chunk by chunk to receiver with backpressure control
   */
  async _streamFileToReceiver(conn, file) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let chunkIndex = 0;
    let offset = 0;
    const startTime = performance.now();
    let lastReportTime = startTime;
    let bytesSentSinceReport = 0;

    if (this.onTransferStart) {
      this.onTransferStart({
        role: 'sender',
        name: file.name,
        size: file.size,
        totalChunks
      });
    }

    // Direct access to underlying RTCDataChannel for backpressure handling
    const dataChannel = conn.dataChannel;
    if (dataChannel) {
      dataChannel.binaryType = 'arraybuffer';
      dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE * 4;
    }

    const sendNextChunk = async () => {
      if (!conn.open) return;

      while (offset < file.size) {
        // Check backpressure if bufferedAmount is too high
        if (dataChannel && dataChannel.bufferedAmount > CHUNK_SIZE * 8) {
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            sendNextChunk();
          };
          return; // pause loop until buffer drains
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        // Send raw ArrayBuffer chunk
        conn.send(buffer);

        offset += buffer.byteLength;
        chunkIndex++;
        bytesSentSinceReport += buffer.byteLength;

        // Progress calculation
        const now = performance.now();
        if (now - lastReportTime >= 150 || offset >= file.size) {
          const duration = (now - lastReportTime) / 1000;
          const speed = duration > 0 ? (bytesSentSinceReport / duration) : 0;
          const percent = Math.min(100, Math.round((offset / file.size) * 100));

          if (this.onProgress) {
            this.onProgress({
              role: 'sender',
              percent,
              transferredBytes: offset,
              totalBytes: file.size,
              currentChunk: chunkIndex,
              totalChunks,
              speedBytesPerSec: speed
            });
          }

          lastReportTime = now;
          bytesSentSinceReport = 0;
        }
      }

      // Signal end of file
      conn.send({ type: 'EOF' });
    };

    sendNextChunk();
  }

  /**
   * Connects as a Receiver to a Sender using 6-digit code
   */
  async connectAndReceive(code) {
    this.destroy();
    this.isSender = false;
    this.activeCode = code.trim();
    this.transferState = 'connecting';

    return new Promise((resolve, reject) => {
      const targetPeerId = PEER_PREFIX + this.activeCode;
      
      try {
        this.peer = new Peer(null, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
      } catch (err) {
        this.transferState = 'error';
        if (this.onError) this.onError('Failed to initiate receiver peer.');
        reject(err);
        return;
      }

      let connectionTimeout = setTimeout(() => {
        if (this.transferState === 'connecting') {
          this.transferState = 'error';
          const err = new Error(`Code ${this.activeCode} is not active or sender is offline. Make sure the sender's tab is open!`);
          if (this.onError) this.onError(err.message);
          this.destroy();
          reject(err);
        }
      }, 9000);

      this.peer.on('open', () => {
        if (this.onStatusChange) {
          this.onStatusChange({
            state: 'connecting',
            message: `Looking for active sender with code: ${this.activeCode}...`
          });
        }

        const conn = this.peer.connect(targetPeerId, {
          reliable: true,
          serialization: 'binary'
        });

        this.connection = conn;

        conn.on('open', () => {
          clearTimeout(connectionTimeout);
          this.transferState = 'connected';
          if (this.onStatusChange) {
            this.onStatusChange({
              state: 'connected',
              message: 'Connected to sender! Requesting data...'
            });
          }
          resolve(conn);
        });

        this._setupReceiverHandlers(conn);
      });

      this.peer.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('Peer receiver error:', err);
        let msg = 'Failed to connect to sender.';
        if (err.type === 'peer-unavailable') {
          msg = `Code "${this.activeCode}" is not active or sender has closed their tab.`;
        }
        this.transferState = 'error';
        if (this.onError) this.onError(msg);
        reject(new Error(msg));
      });
    });
  }

  /**
   * Sets up incoming data handlers on receiver side
   */
  _setupReceiverHandlers(conn) {
    let metadata = null;
    let receivedChunks = [];
    let receivedBytes = 0;
    let chunkCount = 0;
    let startTime = null;
    let lastReportTime = null;
    let bytesSinceReport = 0;

    conn.on('data', (data) => {
      // Check if data is a control message (JSON object)
      if (data && typeof data === 'object' && !(data instanceof ArrayBuffer)) {
        if (data.type === 'META') {
          metadata = data;
          receivedChunks = [];
          receivedBytes = 0;
          chunkCount = 0;
          startTime = performance.now();
          lastReportTime = startTime;
          bytesSinceReport = 0;

          if (this.onTransferStart) {
            this.onTransferStart({
              role: 'receiver',
              payloadType: data.payloadType,
              name: data.name || data.title,
              size: data.size,
              totalChunks: data.totalChunks || 1
            });
          }

          // Acknowledge metadata and signal ready to receive stream
          conn.send({ type: 'READY_FOR_DATA' });
          return;
        }

        if (data.type === 'NOTE_CONTENT') {
          // Received direct note text
          this.transferState = 'completed';
          conn.send({ type: 'TRANSFER_SUCCESS' });

          if (this.onTransferComplete) {
            this.onTransferComplete({
              role: 'receiver',
              type: 'note',
              title: data.title,
              text: data.text,
              size: new Blob([data.text]).size
            });
          }
          return;
        }

        if (data.type === 'EOF') {
          // File transmission finished
          this.transferState = 'completed';
          conn.send({ type: 'TRANSFER_SUCCESS' });

          const blob = new Blob(receivedChunks, {
            type: (metadata && metadata.mimeType) || 'application/octet-stream'
          });

          if (this.onTransferComplete) {
            this.onTransferComplete({
              role: 'receiver',
              type: 'file',
              name: metadata.name,
              size: blob.size,
              mimeType: metadata.mimeType,
              blob: blob,
              url: URL.createObjectURL(blob)
            });
          }

          // Free chunk array from memory
          receivedChunks = [];
          return;
        }
      }

      // Binary Chunk received (ArrayBuffer or Uint8Array)
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const buffer = data instanceof ArrayBuffer ? data : data.buffer;
        receivedChunks.push(buffer);
        receivedBytes += buffer.byteLength;
        bytesSinceReport += buffer.byteLength;
        chunkCount++;

        const now = performance.now();
        if (now - lastReportTime >= 150 || (metadata && receivedBytes >= metadata.size)) {
          const duration = (now - lastReportTime) / 1000;
          const speed = duration > 0 ? (bytesSinceReport / duration) : 0;
          const totalSize = (metadata && metadata.size) || receivedBytes;
          const percent = Math.min(100, Math.round((receivedBytes / totalSize) * 100));

          if (this.onProgress) {
            this.onProgress({
              role: 'receiver',
              percent,
              transferredBytes: receivedBytes,
              totalBytes: totalSize,
              currentChunk: chunkCount,
              totalChunks: metadata ? metadata.totalChunks : 0,
              speedBytesPerSec: speed
            });
          }

          lastReportTime = now;
          bytesSinceReport = 0;
        }
      }
    });

    conn.on('close', () => {
      if (this.transferState !== 'completed' && this.transferState !== 'idle') {
        if (this.onError) {
          this.onError('Sender connection closed unexpectedly.');
        }
      }
    });
  }

  /**
   * Destroys active peers and connections, clearing memory
   */
  destroy() {
    this.activeReceivers.forEach(c => {
      try { c.close(); } catch (e) {}
    });
    this.activeReceivers = [];

    if (this.connection) {
      try { this.connection.close(); } catch (e) {}
      this.connection = null;
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.currentPayload = null;
    this.transferState = 'idle';
    this.activeCode = null;
  }
}

window.PeerTransferEngine = PeerTransferEngine;
