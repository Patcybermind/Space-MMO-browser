// Game variables
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const SPRITE_SPEED = 300; // pixels per second
// Create the application
const app = new PIXI.Application();
// Initialize the application
async function init() {
    await app.init({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x1e3a8a,
        antialias: true
    });
    // Add the canvas to the HTML document
    document.getElementById('gameContainer').appendChild(app.canvas);
    // Create a graphics object to use as our sprite (since we don't have external images)
    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, 50, 50);
    graphics.fill(0xff6b6b);
    graphics.stroke({ width: 2, color: 0xffffff });
    // Create a texture from the graphics
    const texture = app.renderer.generateTexture(graphics);
    
    // Create the sprite from the texture
    const player = new PIXI.Sprite(texture);
    
    // Set the sprite's anchor point to center
    player.anchor.set(0.5);
    
    // Position the sprite in the center of the screen
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT / 2;
    
    // Add the sprite to the stage
    app.stage.addChild(player);
    // Keyboard state tracking
    const keys = {
        w: false,
        a: false,
        s: false,
        d: false
    };
    // Keyboard event listeners
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) {
            keys[key] = true;
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) {
            keys[key] = false;
            e.preventDefault();
        }
    });
    // Game loop with delta time
    app.ticker.add((ticker) => {
        // Calculate delta time in seconds
        const deltaTime = ticker.deltaTime / 60; // Convert from PIXI's delta to seconds
        const moveDistance = SPRITE_SPEED * deltaTime;
        // Handle movement with frame-independent speed
        if (keys.w) {
            player.y = Math.max(player.height / 2, player.y - moveDistance);
        }
        if (keys.s) {
            player.y = Math.min(GAME_HEIGHT - player.height / 2, player.y + moveDistance);
        }
        if (keys.a) {
            player.x = Math.max(player.width / 2, player.x - moveDistance);
        }
        if (keys.d) {
            player.x = Math.min(GAME_WIDTH - player.width / 2, player.x + moveDistance);
        }
        // Add a subtle rotation effect when moving (also frame-independent)
        const isMoving = keys.w || keys.s || keys.a || keys.d;
        if (isMoving) {
            player.rotation += 1.2 * deltaTime; // radians per second
        } else {
            // Gradually return to normal rotation
            player.rotation *= Math.pow(0.95, deltaTime * 60);
        }
    });
    // Add some visual effects 
    const particles = [];
    for (let i = 0; i < 50; i++) {
        const star = new PIXI.Graphics();
        star.circle(0, 0, Math.random() * 2 + 1);
        star.fill(0xffffff);
        star.x = Math.random() * GAME_WIDTH;
        star.y = Math.random() * GAME_HEIGHT;
        star.alpha = Math.random() * 0.5 + 0.3;
        app.stage.addChild(star);
        particles.push(star);
    }
    // Animate background particles with frame-independent timing
    app.ticker.add((ticker) => {
        const time = performance.now() * 0.001; // Convert to seconds
        particles.forEach(particle => {
            particle.alpha = Math.sin(time + particle.x * 0.01) * 0.3 + 0.5;
        });
    });
}
// Start the game
init().catch(console.error);