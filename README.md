# BATMAN
# BATMAN - Cinematic Landing Page

A Batman themed cinematic landing page featuring an interactive snake trail cursor effect. As you move your cursor, it carves through the top image revealing a hidden layer beneath - and fades away the moment you stop.

# Features
- Snake trail cursor that reveals a hidden image layer
- Trail tapers from head to tail and fades on idle
- Ember glow effect around the cursor
- Custom reticle cursor
- Cinematic dark UI with Gotham-style typography

# Built With
- HTML5
- CSS3
- Vanilla JavaScript
- Canvas API

## How It Works
Two images are stacked on an HTML5 Canvas. Every mouse movement logs a trail of points. An offscreen canvas builds a snake-shaped mask from those points using radial gradients, and `destination-out` compositing punches that shape through the top image - revealing the one underneath. The trail fades out after 100ms of no movement.

# Setup
Just drop your images as `img1.png` (top layer) and `img2.png` (bottom layer) and open `index.html` in a browser. No dependencies, no build step.
