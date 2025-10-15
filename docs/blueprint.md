# **App Name**: Decimal Conquest

## Core Features:

- World Map Display: Display a grid-based world map (400x220) where each cell represents a land tile. Show user territories with different colors.  Implement zoom and drag functionalities for map navigation.
- User Registration: Allow users to register and log in using email and password (Firebase Authentication).
- Initial Land Assignment: Assign a random starting land tile to each new user, ensuring it is at least 20 tiles away from other users' territories to prevent early attacks.
- Problem Generation and Submission: Present users with randomly generated decimal addition and subtraction problems, formatted as short answer questions requiring manual numeric and decimal point input.
- Territory Expansion: Award users one 'land expansion token' for each correctly solved problem. Allow them to expand their territory by claiming adjacent tiles (empty or belonging to other users).
- Conquest: Allow a user to claim ownership of land that is owned by another player, by spending a land expansion token. When the land is conquered, its ownership changes instantly.
- Demise and Restart: Implement a 'demise' state when a user loses all their land. Enable them to restart with a new random territory assignment.

## Style Guidelines:

- Primary color: A vibrant green (#50D890), suggestive of territory, growth, and freshness.
- Background color: Light off-white (#F5F5DC) provides a neutral backdrop that doesn't distract from the colorful map elements; it should evoke a feeling of parchment or an ancient map.
- Accent color: Analogous to the primary, a yellow-green (#B5E487) creates contrast and visual interest. It's suitable for interactive elements.
- Font: 'PT Sans', a humanist sans-serif font, will be used for both headlines and body text.
- Design icons representing land, resources, and actions (expanding, conquering) using a consistent, simple style.
- Use a clear, tile-based layout for the world map. Keep UI elements (problem display, territory management) organized and accessible.
- Incorporate subtle animations to indicate actions like territory expansion or conquest. This can improve user feedback.