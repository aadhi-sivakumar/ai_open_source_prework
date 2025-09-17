// Game client for Mini MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.players = {};
        this.myPlayerId = null;
        this.avatars = {};
        this.websocket = null;
        this.avatarImageCache = {}; // Cache for loaded avatar images
        
        // Camera system
        this.camera = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
        
        // Avatar settings
        this.avatarSize = 32;
        this.labelOffset = -10;
        
        // Movement state
        this.movementState = {
            up: false,
            down: false,
            left: false,
            right: false,
            lastDirection: null,
            movementTimer: null
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupEventListeners();
        this.connectToServer();
        this.startAnimationLoop();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update camera dimensions
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.camera.width = this.canvas.width;
            this.camera.height = this.canvas.height;
            this.updateCameraPosition();
            this.draw();
        });
    }
    
    loadWorldMap() {
        const worldImg = new Image();
        worldImg.onload = () => {
            this.worldImage = worldImg;
            this.draw();
        };
        worldImg.onerror = () => {
            console.error('Failed to load world map image');
        };
        worldImg.src = 'world.jpg';
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.camera.x, this.camera.y, this.camera.width, this.camera.height,  // source rectangle
            0, 0, this.canvas.width, this.canvas.height  // destination rectangle
        );
        
        // Draw all players
        this.drawPlayers();
    }
    
    drawPlayers() {
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        if (!player.avatar || !this.avatars[player.avatar]) return;
        
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.camera.x;
        const screenY = player.y - this.camera.y;
        
        // Check if player is visible on screen
        if (screenX < -this.avatarSize || screenX > this.canvas.width + this.avatarSize ||
            screenY < -this.avatarSize || screenY > this.canvas.height + this.avatarSize) {
            return;
        }
        
        // Get avatar data
        const avatarData = this.avatars[player.avatar];
        const direction = player.facing || 'south';
        const frame = player.animationFrame || 0;
        
        // Get the appropriate frame
        let frameData = null;
        if (direction === 'west') {
            // West direction uses flipped east frames
            frameData = avatarData.frames.east[frame];
        } else {
            frameData = avatarData.frames[direction][frame];
        }
        
        if (!frameData) return;
        
        // Create cache key for this specific frame
        const cacheKey = `${player.avatar}_${direction}_${frame}`;
        
        // Check if image is already cached
        if (this.avatarImageCache[cacheKey]) {
            this.drawCachedAvatar(player, screenX, screenY);
        } else {
            // Load and cache the image
            const img = new Image();
            img.onload = () => {
                this.avatarImageCache[cacheKey] = img;
                this.drawCachedAvatar(player, screenX, screenY);
            };
            img.src = frameData;
        }
    }
    
    drawCachedAvatar(player, screenX, screenY) {
        const direction = player.facing || 'south';
        const frame = player.animationFrame || 0;
        const cacheKey = `${player.avatar}_${direction}_${frame}`;
        const img = this.avatarImageCache[cacheKey];
        
        if (!img) return;
        
        // Draw avatar
        this.ctx.drawImage(
            img,
            screenX - this.avatarSize / 2,
            screenY - this.avatarSize / 2,
            this.avatarSize,
            this.avatarSize
        );
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const labelX = screenX;
        const labelY = screenY + this.labelOffset;
        
        // Draw text with outline
        this.ctx.strokeText(player.username, labelX, labelY);
        this.ctx.fillText(player.username, labelX, labelY);
    }
    
    startAnimationLoop() {
        const animate = () => {
            this.draw();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    
    connectToServer() {
        try {
            this.websocket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.websocket.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Error parsing server message:', error);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('Disconnected from game server');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    this.connectToServer();
                }, 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Aadhithya'
        };
        
        this.websocket.send(JSON.stringify(joinMessage));
        console.log('Sent join game message');
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.updateCameraPosition();
                    console.log('Successfully joined game as:', message.playerId);
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateCameraPosition();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    updateCameraPosition() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        
        // Center camera on player
        this.camera.x = myPlayer.x - this.camera.width / 2;
        this.camera.y = myPlayer.y - this.camera.height / 2;
        
        // Clamp camera to world boundaries
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldWidth - this.camera.width));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldHeight - this.camera.height));
    }
    
    setupEventListeners() {
        // Add click event for future click-to-move functionality
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Convert screen coordinates to world coordinates
            const worldX = Math.floor(x + this.camera.x);
            const worldY = Math.floor(y + this.camera.y);
            
            console.log(`Clicked at world coordinates: (${worldX}, ${worldY})`);
        });
        
        // Add keyboard event listeners for movement
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        let direction = null;
        let key = null;
        
        switch(event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                direction = 'up';
                key = 'up';
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                direction = 'down';
                key = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                direction = 'left';
                key = 'left';
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                direction = 'right';
                key = 'right';
                break;
        }
        
        if (direction && !this.movementState[key]) {
            this.movementState[key] = true;
            this.startMovement(direction);
        }
    }
    
    handleKeyUp(event) {
        let key = null;
        
        switch(event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                key = 'up';
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                key = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                key = 'left';
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                key = 'right';
                break;
        }
        
        if (key) {
            this.movementState[key] = false;
            this.updateMovement();
        }
    }
    
    startMovement(direction) {
        // Send immediate move command
        this.sendMoveCommand(direction);
        
        // Start continuous movement timer
        this.movementState.movementTimer = setInterval(() => {
            this.updateMovement();
        }, 100); // Send move command every 100ms
    }
    
    updateMovement() {
        const activeDirections = [];
        
        if (this.movementState.up) activeDirections.push('up');
        if (this.movementState.down) activeDirections.push('down');
        if (this.movementState.left) activeDirections.push('left');
        if (this.movementState.right) activeDirections.push('right');
        
        if (activeDirections.length === 0) {
            // No keys pressed, stop movement
            this.stopMovement();
        } else {
            // Send move command for the first active direction
            // This handles multiple keys by prioritizing the first one
            const direction = activeDirections[0];
            this.sendMoveCommand(direction);
        }
    }
    
    stopMovement() {
        if (this.movementState.movementTimer) {
            clearInterval(this.movementState.movementTimer);
            this.movementState.movementTimer = null;
        }
        
        // Send stop command to server
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ action: 'stop' }));
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.websocket.send(JSON.stringify(moveMessage));
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});