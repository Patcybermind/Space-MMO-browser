// Game Configuration
const CONFIG = {
    GAME: {
        WIDTH: 800,
        HEIGHT: 600,
        BACKGROUND_COLOR: 0x0f0f0f
    },
    ROCKET: {
        ACCELERATION: 0.1,
        ROTATION_SPEED: 180, // degrees per second
        RADIUS: 12,
        COLOR: 0xff6b6b
    },
    EARTH: {
        COLOR: 0x009900,
        SIZE: 75, // radius
        GRAVITY: 9.8
    },
    STARS: {
        RENDER_DISTANCE: 1200,
        FADE_DISTANCE: 200,
        GRID_CELL_SIZE: 800,
        SANDBOX_SIZE: 100,
        DENSITY: 50
    },
    CAMERA: {
        SMOOTHING: 0.1
    }
};

// Spatial Grid Class for efficient star management
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    
    getGridKey(x, y) {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        return `${gridX},${gridY}`;
    }
    
    addStar(star) {
        const key = this.getGridKey(star.x, star.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(star);
        star.gridKey = key;
    }
    
    getStarsNear(x, y, radius) {
        const stars = [];
        const cellsToCheck = Math.ceil(radius / this.cellSize) + 1;
        const centerGridX = Math.floor(x / this.cellSize);
        const centerGridY = Math.floor(y / this.cellSize);
        
        for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
            for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
                const key = `${centerGridX + dx},${centerGridY + dy}`;
                const cellStars = this.grid.get(key);
                if (cellStars) {
                    stars.push(...cellStars);
                }
            }
        }
        
        return stars;
    }
}

// Player Class
class Player {
    constructor(app, world, x, y) {
        this.app = app;
        this.world = world;
        this.x = x;
        this.y = y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.orientation = 90; // degrees
        this.sprite = null;
        
        this.createSprite();
    }
    
    createSprite() {
        const graphics = new PIXI.Graphics();
        graphics.moveTo(-15, 0);   // Left point (nose)
        graphics.lineTo(15, -10);  // Bottom right
        graphics.lineTo(15, 10);   // Top right
        graphics.lineTo(-15, 0);   // Close the triangle
        graphics.fill(CONFIG.ROCKET.COLOR);
        graphics.stroke({ width: 2, color: 0xffffff });
        
        const texture = this.app.renderer.generateTexture(graphics);
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.zIndex = 2;
        this.sprite.rotation = this.orientation * (Math.PI / 180);
        
        this.world.addChild(this.sprite);
    }
    
    rotate(direction, deltaTime) {
        this.orientation += direction * CONFIG.ROCKET.ROTATION_SPEED * (deltaTime / 60);
        this.sprite.rotation = this.orientation * (Math.PI / 180);
    }
    
    thrust(deltaTime) {
        const adjustedAcceleration = CONFIG.ROCKET.ACCELERATION * deltaTime;
        const thrustX = adjustedAcceleration * Math.cos(this.sprite.rotation);
        const thrustY = adjustedAcceleration * Math.sin(this.sprite.rotation);
        
        return { x: -thrustX, y: -thrustY }; // Negative because we want to thrust forward
    }
    
    applyGravity(earth, deltaTime) {
        const dx = earth.x - this.x;
        const dy = earth.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const adjustedGravity = ((CONFIG.EARTH.GRAVITY * 5) / (2 * Math.pow(((distance + 160) / 15), 2)));
        const gravityDirection = Math.atan2(dy, dx);
        
        return {
            x: adjustedGravity * Math.cos(gravityDirection),
            y: adjustedGravity * Math.sin(gravityDirection)
        };
    }
    
    update(deltaTime, earth, inputManager) {
        // Handle rotation
        if (inputManager.isPressed('a')) {
            this.rotate(-1, deltaTime);
        }
        if (inputManager.isPressed('d')) {
            this.rotate(1, deltaTime);
        }
        
        // Apply gravity
        const gravity = this.applyGravity(earth, deltaTime);
        let accelerationX = gravity.x;
        let accelerationY = gravity.y;
        
        // Apply thrust
        if (inputManager.isPressed('w')) {
            const thrust = this.thrust(deltaTime);
            accelerationX += thrust.x;
            accelerationY += thrust.y;
        }
        
        // Update velocity and position
        this.velocityX += accelerationX;
        this.velocityY += accelerationY;
        
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;
        
        // Update sprite position
        this.sprite.x = this.x;
        this.sprite.y = this.y;
    }
    
    checkCollisionWithEarth(earth) {
        const dx = this.x - earth.x;
        const dy = this.y - earth.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const collisionDistance = CONFIG.EARTH.SIZE + CONFIG.ROCKET.RADIUS;
        
        if (distance <= collisionDistance) {
            // Calculate collision normal
            const normalX = dx / distance;
            const normalY = dy / distance;
            
            // Push player out of Earth
            this.x = earth.x + normalX * collisionDistance;
            this.y = earth.y + normalY * collisionDistance;
            this.sprite.x = this.x;
            this.sprite.y = this.y;
            
            // Reflect velocity with energy loss
            const dotProduct = this.velocityX * normalX + this.velocityY * normalY;
            const bounceStrength = 0.5;
            
            this.velocityX = (this.velocityX - 2 * dotProduct * normalX) * bounceStrength;
            this.velocityY = (this.velocityY - 2 * dotProduct * normalY) * bounceStrength;
        }
    }
    
    getSpeed() {
        return Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    }
}

// Earth Class
class Earth {
    constructor(app, world, x, y) {
        this.app = app;
        this.world = world;
        this.x = x;
        this.y = y;
        this.sprite = null;
        
        this.createSprite();
    }
    
    createSprite() {
        const graphics = new PIXI.Graphics();
        graphics.circle(0, 0, CONFIG.EARTH.SIZE);
        graphics.fill(CONFIG.EARTH.COLOR);
        
        const texture = this.app.renderer.generateTexture(graphics);
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.zIndex = 1;
        
        this.world.addChild(this.sprite);
    }
}

// Star System Class
class StarSystem {
    constructor(app, world) {
        this.app = app;
        this.world = world;
        this.spatialGrid = new SpatialGrid(CONFIG.STARS.GRID_CELL_SIZE);
        this.visibleStars = new Set();
        this.totalStars = 0;
        
        this.generateStars();
    }
    
    generateStars() {
        const totalStars = CONFIG.STARS.DENSITY * Math.pow((CONFIG.STARS.SANDBOX_SIZE / 4), 2) * 4;
        this.totalStars = totalStars;
        
        console.log(`Creating ${totalStars} stars...`);
        
        for (let i = 0; i < totalStars; i++) {
            const starData = {
                x: (Math.random() - 0.5) * CONFIG.GAME.WIDTH * CONFIG.STARS.SANDBOX_SIZE,
                y: (Math.random() - 0.5) * CONFIG.GAME.WIDTH * CONFIG.STARS.SANDBOX_SIZE,
                size: Math.random() * 2 + 1,
                baseAlpha: Math.random() * 0.5 + 0.3,
                sprite: null,
                animationOffset: Math.random() * Math.PI * 2
            };
            
            this.spatialGrid.addStar(starData);
        }
        
        console.log(`Stars created and added to spatial grid.`);
    }
    
    createStarSprite(starData) {
        if (starData.sprite) return starData.sprite;
        
        const star = new PIXI.Graphics();
        star.circle(0, 0, starData.size);
        star.fill(0xffffff);
        star.x = starData.x;
        star.y = starData.y;
        star.alpha = starData.baseAlpha;
        starData.sprite = star;
        return star;
    }
    
    updateVisibility(playerX, playerY) {
        const maxDistance = CONFIG.STARS.RENDER_DISTANCE + CONFIG.STARS.FADE_DISTANCE;
        const nearbyStars = this.spatialGrid.getStarsNear(playerX, playerY, maxDistance);
        const newVisibleStars = new Set();
        
        nearbyStars.forEach(starData => {
            const dx = starData.x - playerX;
            const dy = starData.y - playerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxDistance) {
                newVisibleStars.add(starData);
                
                if (!this.visibleStars.has(starData)) {
                    if (!starData.sprite) {
                        this.createStarSprite(starData);
                    }
                    this.world.addChild(starData.sprite);
                }
                
                // Update alpha based on distance
                if (distance <= CONFIG.STARS.RENDER_DISTANCE) {
                    starData.sprite.alpha = starData.baseAlpha;
                } else {
                    const fadeProgress = (distance - CONFIG.STARS.RENDER_DISTANCE) / CONFIG.STARS.FADE_DISTANCE;
                    starData.sprite.alpha = starData.baseAlpha * (1 - fadeProgress);
                }
            }
        });
        
        // Remove stars that are no longer visible
        this.visibleStars.forEach(starData => {
            if (!newVisibleStars.has(starData)) {
                if (starData.sprite) {
                    this.world.removeChild(starData.sprite);
                }
            }
        });
        
        this.visibleStars.clear();
        newVisibleStars.forEach(star => this.visibleStars.add(star));
        
        return {
            visible: this.visibleStars.size,
            checked: nearbyStars.length,
            total: this.totalStars
        };
    }
    
    animate() {
        const time = performance.now() * 0.001;
        this.visibleStars.forEach(starData => {
            if (starData.sprite) {
                const twinkle = Math.sin(time * 2 + starData.animationOffset) * 0.3 + 0.7;
                starData.sprite.alpha = starData.sprite.alpha * twinkle;
            }
        });
    }
}

// Input Manager Class
class InputManager {
    constructor() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
                e.preventDefault();
            }
        });
    }
    
    isPressed(key) {
        return this.keys[key] || false;
    }
}

// Camera Class
class Camera {
    constructor(world) {
        this.world = world;
        this.x = 0;
        this.y = 0;
    }
    
    follow(target) {
        const targetX = CONFIG.GAME.WIDTH / 2 - target.x;
        const targetY = CONFIG.GAME.HEIGHT / 2 - target.y;
        
        this.x += (targetX - this.x) * CONFIG.CAMERA.SMOOTHING;
        this.y += (targetY - this.y) * CONFIG.CAMERA.SMOOTHING;
        
        this.world.x = this.x;
        this.world.y = this.y;
    }
}

// UI Manager Class
class UIManager {
    constructor(app, ui) {
        this.app = app;
        this.ui = ui;
        this.elements = {};
        
        this.createUI();
    }
    
    createUI() {
        // Speed indicator
        this.elements.speedText = new PIXI.Text({
            text: 'Speed: 0',
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xffffff,
                stroke: { color: 0x000000, width: 2 }
            }
        });
        this.elements.speedText.x = 10;
        this.elements.speedText.y = 10;
        this.ui.addChild(this.elements.speedText);
        
        // Stars counter
        this.elements.starsText = new PIXI.Text({
            text: 'Stars: 0',
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xffffff,
                stroke: { color: 0x000000, width: 2 }
            }
        });
        this.elements.starsText.x = 10;
        this.elements.starsText.y = 30;
        this.ui.addChild(this.elements.starsText);
        
        // Performance counter
        this.elements.perfText = new PIXI.Text({
            text: 'Checked: 0',
            style: {
                fontFamily: 'Arial',
                fontSize: 16,
                fill: 0xffffff,
                stroke: { color: 0x000000, width: 2 }
            }
        });
        this.elements.perfText.x = 10;
        this.elements.perfText.y = 50;
        this.ui.addChild(this.elements.perfText);
        
        // Earth direction arrow
        this.createEarthArrow();
    }
    
    createEarthArrow() {
        const arrowGraphics = new PIXI.Graphics();
        arrowGraphics.moveTo(-10, 0);
        arrowGraphics.lineTo(10, -8);
        arrowGraphics.lineTo(5, 0);
        arrowGraphics.lineTo(10, 8);
        arrowGraphics.lineTo(-10, 0);
        arrowGraphics.fill(CONFIG.EARTH.COLOR);
        
        const arrowTexture = this.app.renderer.generateTexture(arrowGraphics);
        this.elements.earthArrow = new PIXI.Sprite(arrowTexture);
        this.elements.earthArrow.anchor.set(0.5);
        this.elements.earthArrow.visible = false;
        this.ui.addChild(this.elements.earthArrow);
    }
    
    updateSpeed(speed) {
        this.elements.speedText.text = `Speed: ${(Math.round(speed * 5)) / 5} m/s`;
    }
    
    updateStarCount(visible, total, checked) {
        this.elements.starsText.text = `Stars: ${visible}/${total}`;
        this.elements.perfText.text = `Checked: ${checked}`;
    }
    
    updateEarthArrow(earth, camera) {
        const earthScreenX = earth.x + camera.x;
        const earthScreenY = earth.y + camera.y;
        const earthOnScreen = earthScreenX > -CONFIG.EARTH.SIZE && 
                             earthScreenX < CONFIG.GAME.WIDTH + CONFIG.EARTH.SIZE && 
                             earthScreenY > -CONFIG.EARTH.SIZE && 
                             earthScreenY < CONFIG.GAME.HEIGHT + CONFIG.EARTH.SIZE;
        
        if (!earthOnScreen) {
            this.elements.earthArrow.visible = true;
            
            const dirX = earthScreenX - CONFIG.GAME.WIDTH / 2;
            const dirY = earthScreenY - CONFIG.GAME.HEIGHT / 2;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            const normalizedDirX = dirX / dirLength;
            const normalizedDirY = dirY / dirLength;
            
            const margin = 30;
            let arrowX, arrowY;
            
            const absX = Math.abs(normalizedDirX);
            const absY = Math.abs(normalizedDirY);
            
            if (absX > absY) {
                if (normalizedDirX > 0) {
                    arrowX = CONFIG.GAME.WIDTH - margin;
                    arrowY = CONFIG.GAME.HEIGHT / 2 + (normalizedDirY / normalizedDirX) * (CONFIG.GAME.WIDTH / 2 - margin);
                } else {
                    arrowX = margin;
                    arrowY = CONFIG.GAME.HEIGHT / 2 - (normalizedDirY / normalizedDirX) * (CONFIG.GAME.WIDTH / 2 - margin);
                }
            } else {
                if (normalizedDirY > 0) {
                    arrowY = CONFIG.GAME.HEIGHT - margin;
                    arrowX = CONFIG.GAME.WIDTH / 2 + (normalizedDirX / normalizedDirY) * (CONFIG.GAME.HEIGHT / 2 - margin);
                } else {
                    arrowY = margin;
                    arrowX = CONFIG.GAME.WIDTH / 2 - (normalizedDirX / normalizedDirY) * (CONFIG.GAME.HEIGHT / 2 - margin);
                }
            }
            
            arrowX = Math.max(margin, Math.min(CONFIG.GAME.WIDTH - margin, arrowX));
            arrowY = Math.max(margin, Math.min(CONFIG.GAME.HEIGHT - margin, arrowY));
            
            this.elements.earthArrow.x = arrowX;
            this.elements.earthArrow.y = arrowY;
            this.elements.earthArrow.rotation = Math.atan2(normalizedDirY, normalizedDirX) + Math.PI;
        } else {
            this.elements.earthArrow.visible = false;
        }
    }
}

// Main Game Class
class Game {
    constructor() {
        this.app = new PIXI.Application();
        this.world = null;
        this.ui = null;
        this.player = null;
        this.earth = null;
        this.starSystem = null;
        this.inputManager = null;
        this.camera = null;
        this.uiManager = null;
    }
    
    async init() {
        await this.app.init({
            width: CONFIG.GAME.WIDTH,
            height: CONFIG.GAME.HEIGHT,
            backgroundColor: CONFIG.GAME.BACKGROUND_COLOR,
            antialias: true
        });
        
        document.getElementById('gameContainer').appendChild(this.app.canvas);
        
        this.setupContainers();
        this.createGameObjects();
        this.setupGameLoop();
    }
    
    setupContainers() {
        this.world = new PIXI.Container();
        this.ui = new PIXI.Container();
        this.app.stage.addChild(this.world);
        this.app.stage.addChild(this.ui);
    }
    
    createGameObjects() {
        // Create game objects
        this.player = new Player(this.app, this.world, CONFIG.GAME.WIDTH / 4, CONFIG.GAME.HEIGHT / 4);
        this.earth = new Earth(this.app, this.world, CONFIG.GAME.WIDTH / 2, CONFIG.GAME.HEIGHT / 2);
        this.starSystem = new StarSystem(this.app, this.world);
        
        // Create systems
        this.inputManager = new InputManager();
        this.camera = new Camera(this.world);
        this.uiManager = new UIManager(this.app, this.ui);
        
        // Initial star visibility update
        this.starSystem.updateVisibility(this.player.x, this.player.y);
    }
    
    setupGameLoop() {
        // Main game loop
        this.app.ticker.add((ticker) => {
            const deltaTime = ticker.deltaTime;
            
            // Update game objects
            this.player.update(deltaTime, this.earth, this.inputManager);
            this.player.checkCollisionWithEarth(this.earth);
            
            // Update systems
            this.camera.follow(this.player);
            const starStats = this.starSystem.updateVisibility(this.player.x, this.player.y);
            
            // Update UI
            this.uiManager.updateSpeed(this.player.getSpeed());
            this.uiManager.updateStarCount(starStats.visible, starStats.total, starStats.checked);
            this.uiManager.updateEarthArrow(this.earth, this.camera);
        });
        
        // Star animation loop
        this.app.ticker.add(() => {
            this.starSystem.animate();
        });
    }
}

// Initialize and start the games
async function init() {
    const game = new Game();
    await game.init();
}

// Start the game
init().catch(console.error);