// Game variables
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const ROCKET_ACCELERATION = 0.1; 
const rocket_rotation_speed = 180; // degreess per second

const EARTH_COLOR = 0x009900;
const EARTH_SIZE = GAME_HEIGHT / 8; // Radius of the Earth in pixels, 100 pixels
const EARTH_GRAVITY = 9.8; // Earth gravity in m/s^2, not used in this example but can be used for physics calculations

// Star culling variables
const STAR_RENDER_DISTANCE = 1200; // Distance at which stars become visible
const STAR_FADE_DISTANCE = 200; // Additional distance for smooth fade-in/out

// Spatial partitioning variables
const GRID_CELL_SIZE = 800; // Size of each grid cell (should be >= STAR_RENDER_DISTANCE for efficiency)

// Camera variables
const CAMERA_SMOOTHING = 0.1; // How smooth the camera follows (0-1, higher = more responsive)

// Create the application
const app = new PIXI.Application();

// Spatial grid for star management
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map(); // Use Map for better performance with string keys
    }
    
    // Convert world coordinates to grid coordinates
    getGridKey(x, y) {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        return `${gridX},${gridY}`;
    }
    
    // Add star to grid
    addStar(star) {
        const key = this.getGridKey(star.x, star.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(star);
        star.gridKey = key; // Store grid key on star for quick removal
    }
    
    // Get all stars in cells near a position
    getStarsNear(x, y, radius) {
        const stars = [];
        const cellsToCheck = Math.ceil(radius / this.cellSize) + 1;
        const centerGridX = Math.floor(x / this.cellSize);
        const centerGridY = Math.floor(y / this.cellSize);
        
        // Check surrounding cells
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

// Initialize the application
async function init() {
    await app.init({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x0f0f0f,
        antialias: true
    });
    // Add the canvas to the HTML document
    document.getElementById('gameContainer').appendChild(app.canvas);

    // Create a world container to hold all game objects
    const world = new PIXI.Container();
    app.stage.addChild(world);

    // Create UI container for HUD elements (not affected by camera)
    const ui = new PIXI.Container();
    app.stage.addChild(ui);

    // Speed indicator
    const speedText = new PIXI.Text({
        text: 'Speed: 0',
        style: {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 }
        }
    });
    speedText.x = 10;
    speedText.y = 10;
    ui.addChild(speedText);

    // Stars rendered counter
    const starsText = new PIXI.Text({
        text: 'Stars: 0',
        style: {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 }
        }
    });
    starsText.x = 10;
    starsText.y = 30;
    ui.addChild(starsText);

    // Performance counter
    const perfText = new PIXI.Text({
        text: 'Checked: 0',
        style: {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 }
        }
    });
    perfText.x = 10;
    perfText.y = 50;
    ui.addChild(perfText);

    // Create Earth direction arrow
    const arrowGraphics = new PIXI.Graphics();
    arrowGraphics.moveTo(-10, 0);   // Left point
    arrowGraphics.lineTo(10, -8);   // Top right
    arrowGraphics.lineTo(5, 0);     // Middle right
    arrowGraphics.lineTo(10, 8);    // Bottom right
    arrowGraphics.lineTo(-10, 0);   // Close the arrow
    arrowGraphics.fill(EARTH_COLOR);
    
    const arrowTexture = app.renderer.generateTexture(arrowGraphics);
    const earthArrow = new PIXI.Sprite(arrowTexture);
    earthArrow.anchor.set(0.5);
    earthArrow.visible = false;
    ui.addChild(earthArrow);

    // Camera target position
    let cameraX = 0;
    let cameraY = 0;

    // PLAYER 
    const graphics = new PIXI.Graphics();
    // Draw a triangle pointing to the left (matches thrust direction)
    graphics.moveTo(-15, 0);   // Left point (nose)
    graphics.lineTo(15, -10);  // Bottom right
    graphics.lineTo(15, 10);   // Top right
    graphics.lineTo(-15, 0);   // Close the triangle
    graphics.fill(0xff6b6b);
    graphics.stroke({ width: 2, color: 0xffffff });
    // Create a texture from the graphics
    const texture = app.renderer.generateTexture(graphics);
    
    // Create the sprite from the texture
    const player = new PIXI.Sprite(texture);
    
    // Set the sprite's anchor point to center
    player.anchor.set(0.5);
    
    // Position the sprite in the center of the screen s
    player.x = GAME_WIDTH / 4;
    player.y = GAME_HEIGHT / 4;
    
    player.zIndex = 2;
    // Add the sprite to the world container instead of stage
    world.addChild(player);

    // EARTH
    // Create a new graphics object for the Earth
    const earthGraphics = new PIXI.Graphics();
    // Draw a circle to represent the Earth
    earthGraphics.circle(0, 0, EARTH_SIZE); 
    earthGraphics.fill(EARTH_COLOR); 
    // Create a texture from the Earth graphics - THIS IS THE FIX
    const earthTexture = app.renderer.generateTexture(earthGraphics);
    // Create the Earth sprite from the texture
    const earth = new PIXI.Sprite(earthTexture);
    // Set the Earth's anchor point to center
    earth.anchor.set(0.5);
    // Position the Earth at the bottom of the screen
    earth.x = GAME_WIDTH / 2;
    earth.y = GAME_HEIGHT / 2; // 100 pixels from the bottom
    
    // set in front of stars
    earth.zIndex = 1;
    // Add the Earth sprite to the world container
    world.addChild(earth);

    // STARS - Enhanced star system with spatial partitioning
    const spatialGrid = new SpatialGrid(GRID_CELL_SIZE);
    const visibleStars = new Set(); // Track currently visible stars for efficient updates
    const STAR_SANDBOX_SIZE = 500; // Size of the star sandbox area in game widths
    const totalStars = 50 * Math.pow((STAR_SANDBOX_SIZE/4), 2) * 4;
    
    console.log(`Creating ${totalStars} stars...`);
    
    // Create all stars and add them to the spatial grid
    for (let i = 0; i < totalStars; i++) {
        const starData = {
            x: (Math.random() - 0.5) * GAME_WIDTH * STAR_SANDBOX_SIZE,
            y: (Math.random() - 0.5) * GAME_WIDTH * STAR_SANDBOX_SIZE,
            size: Math.random() * 2 + 1,
            baseAlpha: Math.random() * 0.5 + 0.3,
            sprite: null, // Will be created when needed
            animationOffset: Math.random() * Math.PI * 2 // For twinkling animation
        };
        
        spatialGrid.addStar(starData);
    }
    
    console.log(`Stars created and added to spatial grid.`);

    // Function to create a star sprite
    function createStarSprite(starData) {
        if (starData.sprite) return starData.sprite; // Already created
        
        const star = new PIXI.Graphics();
        star.circle(0, 0, starData.size);
        star.fill(0xffffff);
        star.x = starData.x;
        star.y = starData.y;
        star.alpha = starData.baseAlpha;
        starData.sprite = star;
        return star;
    }

    // Function to update star visibility using spatial partitioning
    function updateStarVisibility() {
        const maxDistance = STAR_RENDER_DISTANCE + STAR_FADE_DISTANCE;
        
        // Get only nearby stars using spatial grid
        const nearbyStars = spatialGrid.getStarsNear(player.x, player.y, maxDistance);
        const newVisibleStars = new Set();
        let starsChecked = nearbyStars.length;
        
        // Check distance only for nearby stars
        nearbyStars.forEach(starData => {
            const dx = starData.x - player.x;
            const dy = starData.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= maxDistance) {
                newVisibleStars.add(starData);
                
                // Add to world if not already visible
                if (!visibleStars.has(starData)) {
                    if (!starData.sprite) {
                        createStarSprite(starData);
                    }
                    world.addChild(starData.sprite);
                }
                
                // Update alpha based on distance for smooth fade
                if (distance <= STAR_RENDER_DISTANCE) {
                    starData.sprite.alpha = starData.baseAlpha;
                } else {
                    const fadeProgress = (distance - STAR_RENDER_DISTANCE) / STAR_FADE_DISTANCE;
                    starData.sprite.alpha = starData.baseAlpha * (1 - fadeProgress);
                }
            }
        });
        
        // Remove stars that are no longer visible
        visibleStars.forEach(starData => {
            if (!newVisibleStars.has(starData)) {
                if (starData.sprite) {
                    world.removeChild(starData.sprite);
                }
            }
        });
        
        // Update the visible stars set
        visibleStars.clear();
        newVisibleStars.forEach(star => visibleStars.add(star));
        
        // Update UI counters
        starsText.text = `Stars: ${visibleStars.size}/${totalStars}`;
        perfText.text = `Checked: ${starsChecked}`;
    }

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

    let normal_velocity_x = 0;
    let normal_velocity_y = 0;
    let rocket_orientation = 90; 
    player.rotation = rocket_orientation * (Math.PI / 180); // Set initial rotation in radians

    // GAME LOOP
    app.ticker.add((ticker) => {
        const deltaTime = ticker.deltaTime; // Convert from PIXI's delta to seconds remember that 1 second is 60

        if (keys.a) {
            rocket_orientation -= rocket_rotation_speed * (deltaTime/60); // Rotate left
            player.rotation = rocket_orientation * (Math.PI / 180); // Set rotation in radians
        }
        if (keys.d) {
            rocket_orientation += rocket_rotation_speed * (deltaTime/60); // Rotate right
            player.rotation = rocket_orientation * (Math.PI / 180); // Set rotation in radians
        }

        const distance_to_earth = Math.sqrt(Math.pow(player.x - earth.x, 2) + Math.pow(player.y - earth.y, 2));
        const adjusted_gravity = ((EARTH_GRAVITY * 5) / ( 2 * Math.pow(((distance_to_earth + (160)) / 15) , 2))); // Adjust gravity for frame rate
        const adjusted_rocket_acceleration = ROCKET_ACCELERATION * deltaTime; // Adjust rocket acceleration for frame rate

        const gravity_direction_in_radians = Math.atan2(earth.y - player.y, earth.x - player.x); // Calculate the direction to the Earth in radians
        const gravity_strength_y = adjusted_gravity * Math.sin(gravity_direction_in_radians); // Calculate the y component of gravity
        const gravity_strength_x = adjusted_gravity * Math.cos(gravity_direction_in_radians); // Calculate the x component of gravity
        
        const rocket_acceleration_x = adjusted_rocket_acceleration * Math.cos(player.rotation); // Calculate the x component of rocket acceleration
        const rocket_acceleration_y = adjusted_rocket_acceleration * Math.sin(player.rotation); //
        // calculate gravity and its orientation 
        
        let adjusted_total_velocity_y = normal_velocity_y * deltaTime; // Adjust total velocity for frame rate
        let adjusted_velocity_y = gravity_strength_y + adjusted_total_velocity_y;
        
        let adjusted_total_velocity_x = normal_velocity_x * deltaTime; // Adjust total velocity for frame rate
        let adjusted_velocity_x = gravity_strength_x + adjusted_total_velocity_x;

        if (keys.w) {
            adjusted_velocity_y -= rocket_acceleration_y; // remember that pos value gets bigger as you go down
            adjusted_velocity_x -= rocket_acceleration_x; // Apply rocket acceleration in the x direction
        }
        
        player.y += adjusted_velocity_y; // Apply gravity to the player 
        player.x += adjusted_velocity_x; // Apply gravity to the player
        
        normal_velocity_y = adjusted_velocity_y / deltaTime; // Update normal velocity for next frame
        normal_velocity_x = adjusted_velocity_x / deltaTime; // Update normal velocity for next frame

        // Calculate and display speed
        const currentSpeed = Math.sqrt(normal_velocity_x * normal_velocity_x + normal_velocity_y * normal_velocity_y);
        speedText.text = `Speed: ${(Math.round((currentSpeed)* 5)) / 5} m/s`; // Round to 2 decimal places

        // Update star visibility based on player position
        updateStarVisibility();

        // Camera following logic
        // Calculate target camera position (center player on screen)
        const targetCameraX = GAME_WIDTH / 2 - player.x;
        const targetCameraY = GAME_HEIGHT / 2 - player.y;
        
        // Smooth camera movement using linear interpolation
        cameraX += (targetCameraX - cameraX) * CAMERA_SMOOTHING;
        cameraY += (targetCameraY - cameraY) * CAMERA_SMOOTHING;
        
        // Update Earth direction arrow
        const earthScreenX = earth.x + cameraX;
        const earthScreenY = earth.y + cameraY;
        const earthOnScreen = earthScreenX > -EARTH_SIZE && earthScreenX < GAME_WIDTH + EARTH_SIZE && 
                             earthScreenY > -EARTH_SIZE && earthScreenY < GAME_HEIGHT + EARTH_SIZE;
        
        if (!earthOnScreen) {
            earthArrow.visible = true;
            
            // Calculate direction to Earth from screen center
            const dirX = earthScreenX - GAME_WIDTH / 2;
            const dirY = earthScreenY - GAME_HEIGHT / 2;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            const normalizedDirX = dirX / dirLength;
            const normalizedDirY = dirY / dirLength;
            
            // Find intersection with screen border
            const margin = 30; // Distance from screen edge
            let arrowX, arrowY;
            
            // Check which border the arrow should be on
            const absX = Math.abs(normalizedDirX);
            const absY = Math.abs(normalizedDirY);
            
            if (absX > absY) {
                // Arrow should be on left or right border
                if (normalizedDirX > 0) {
                    arrowX = GAME_WIDTH - margin;
                    arrowY = GAME_HEIGHT / 2 + (normalizedDirY / normalizedDirX) * (GAME_WIDTH / 2 - margin);
                } else {
                    arrowX = margin;
                    arrowY = GAME_HEIGHT / 2 - (normalizedDirY / normalizedDirX) * (GAME_WIDTH / 2 - margin);
                }
            } else {
                // Arrow should be on top or bottom border
                if (normalizedDirY > 0) {
                    arrowY = GAME_HEIGHT - margin;
                    arrowX = GAME_WIDTH / 2 + (normalizedDirX / normalizedDirY) * (GAME_HEIGHT / 2 - margin);
                } else {
                    arrowY = margin;
                    arrowX = GAME_WIDTH / 2 - (normalizedDirX / normalizedDirY) * (GAME_HEIGHT / 2 - margin);
                }
            }
            
            // Clamp arrow position to screen bounds
            arrowX = Math.max(margin, Math.min(GAME_WIDTH - margin, arrowX));
            arrowY = Math.max(margin, Math.min(GAME_HEIGHT - margin, arrowY));
            
            earthArrow.x = arrowX;
            earthArrow.y = arrowY;
            earthArrow.rotation = Math.atan2(normalizedDirY, normalizedDirX) + Math.PI;
        } else {
            earthArrow.visible = false;
        }
        
        // Collision detection with Earth
        const earthRadius = EARTH_SIZE; // Same as Earth's drawn radius
        const playerRadius = 12; // Approximate radius of the triangle sprite
        const collisionDistance = earthRadius + playerRadius;
        
        if (distance_to_earth <= collisionDistance) {
            // Calculate collision normal (direction from Earth center to player)
            const normalX = (player.x - earth.x) / distance_to_earth;
            const normalY = (player.y - earth.y) / distance_to_earth;
            
            // Push player out of Earth to prevent overlap
            player.x = earth.x + normalX * collisionDistance;
            player.y = earth.y + normalY * collisionDistance;
            
            // Calculate velocity reflection
            const dotProduct = normal_velocity_x * normalX + normal_velocity_y * normalY;
            const bounceStrength = 0.5; // How much velocity is retained after bounce (0-1)
            
            // Reflect velocity with energy loss
            normal_velocity_x = (normal_velocity_x - 2 * dotProduct * normalX) * bounceStrength;
            normal_velocity_y = (normal_velocity_y - 2 * dotProduct * normalY) * bounceStrength;
        }

        // Apply camera position to world container
        world.x = cameraX;
        world.y = cameraY;
    });
    
    // Animate visible stars with frame-independent timing 
    app.ticker.add((ticker) => { 
        const time = performance.now() * 0.001; // Convert to seconds
        visibleStars.forEach(starData => {
            if (starData.sprite) {
                const twinkle = Math.sin(time * 2 + starData.animationOffset) * 0.3 + 0.7;
                starData.sprite.alpha = starData.sprite.alpha * twinkle;
            }
        });
    });

    // Initial star visibility update
    updateStarVisibility();
}
// Start the game
init().catch(console.error);