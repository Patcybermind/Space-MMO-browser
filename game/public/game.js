// Game variables
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const SPRITE_SPEED = 300; // pixels per second
const EARTH_GRAVITY = 0.1; // Earth gravity in m/s^2, not used in this example but can be used for physics calculations
const ROCKET_ACCELERATION = 0.2; 
const rocket_rotation_speed = 180; // degreess per second
// Create the application
const app = new PIXI.Application();
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

    


    // PLAYER
    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, 25, 25);
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
    // Add the sprite to the stage
    app.stage.addChild(player);

    // EARTH
    // Create a new graphics object for the Earth
    const earthGraphics = new PIXI.Graphics();
    // Draw a circle to represent the Earth
    earthGraphics.circle(0, 0, GAME_HEIGHT / 10); 
    earthGraphics.fill(0x009900); 
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
    // Add the Earth sprite to the stage
    app.stage.addChild(earth);

    // STARS
    // Add some stars
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
    const adjusted_sprite_speed = SPRITE_SPEED * deltaTime; // Adjust speed for frame rate
    const adjusted_gravity = (EARTH_GRAVITY / ( 0.2 * Math.pow((distance_to_earth) / 50 , 2))); // Adjust gravity for frame rate
    const adjusted_rocket_acceleration = ROCKET_ACCELERATION * deltaTime; // Adjust rocket acceleration for frame rate
    console.log(`Distance to Earth: ${distance_to_earth}, Adjusted Gravity: ${adjusted_gravity}, Adjusted Rocket Acceleration: ${adjusted_rocket_acceleration}`);

    const gravity_direction_in_radians = Math.atan2(earth.y - player.y, earth.x - player.x); // Calculate the direction to the Earth in radians
    const gravity_strength_y = adjusted_gravity * Math.sin(gravity_direction_in_radians); // Calculate the y component of gravity
    const gravity_strength_x = adjusted_gravity * Math.cos(gravity_direction_in_radians); // Calculate the x component of gravity
    
    const rocket_acceleration_x = adjusted_rocket_acceleration * Math.cos(player.rotation); // Calculate the x component of rocket acceleration
    const rocket_acceleration_y = adjusted_rocket_acceleration * Math.sin(player.rotation); //
    // calculate gravity and its orientation 
    
    
    let adjusted_total_velocity_y = normal_velocity_y * deltaTime; // Adjust total velocity for frame rate
    let adjusted_velocity_y = gravity_strength_y + adjusted_total_velocity_y;
    
    let adjusted_total_velocity_x = normal_velocity_x * deltaTime; // Adjust total velocity for frame rate
    let adjusted_velocity_x = gravity_strength_x  + adjusted_total_velocity_x;
    

    if (keys.w) {
        adjusted_velocity_y -= rocket_acceleration_y; // remember that pos value gets bigger as you go down
        adjusted_velocity_x -= rocket_acceleration_x; // Apply rocket acceleration in the x direction
    }
    player.y += adjusted_velocity_y; // Apply gravity to the player 
    //player.x += adjusted_velocity_x
    normal_velocity_y = adjusted_velocity_y / deltaTime; // Update normal velocity for next frame
 
        
    
  


    player.x += adjusted_velocity_x; // Apply gravity to the player
    //player.x += adjusted_velocity_x
    normal_velocity_x = adjusted_velocity_x / deltaTime; // Update normal velocity for next frame
  
    });
    // Animate background particles with frame-independent timing 
    app.ticker.add((ticker) => { 
        const time = performance.now() * 0.001; // Convert to secondsd
        particles.forEach(particle => {
            particle.alpha = Math.sin(time + particle.x * 0.05) * 0.3 + 0.5; // oscillate whiteness 
        });
    });
}
// Start the game
init().catch(console.error);