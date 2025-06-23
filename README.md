# Followers & Following Manager for Duolingo

A Chrome extension that helps you manage your Duolingo followers and following list with enhanced features and better visibility.

## Features

- 👥 View your complete list of followers and people you're following
- 🔄 Unfollow users directly from the extension
- 📊 Track following dates and user information
- 💾 Local storage for quick access to user data
- 🎯 Easy-to-use popup interface
- 🔍 Built-in storage debugger for troubleshooting

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `source` directory from this project

## Usage

1. Click the extension icon in your Chrome toolbar while on Duolingo
2. The popup will show two main tabs:
   - Followers: People who follow you
   - Following: People you follow
3. You can unfollow users directly from the Following tab
4. User data is cached locally for faster loading

## Technical Details

### Architecture

The extension consists of several key components:
- `popup.html` - Main user interface
- `background.js` - Service worker for background tasks
- `index.js` - Core functionality implementation
- `follow_date_manager.js` - Manages following dates
- `storage_debugger.js` - Debug tool for local storage

### Dependencies

- date-fns: ^4.1.0 - For date formatting and manipulation

### Permissions

The extension requires the following permissions:
- `storage` - For storing user data locally
- `cookies` - For authentication with Duolingo
- Host permission for `*.duolingo.com`

## Development

### Project Structure

```
source/
├── app.js
├── background.js
├── follow_date_manager.js
├── index.js
├── manifest.json
├── popup.html
├── storage_debugger.js
├── storage_viewer.html
├── variables.js
├── icons/
├── lib/
├── services/
├── ui/
└── utils/
```

### Setting Up Development Environment

1. Install dependencies:
```bash
npm install
```

2. Make changes to the source code
3. Load the extension in Chrome using Developer mode
4. For debugging, use the storage viewer at `storage_viewer.html`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Troubleshooting

If you encounter issues:
1. Check the browser's console for error messages
2. Use the built-in storage debugger (storage_viewer.html)
3. Ensure you're logged into Duolingo
4. Try clearing the extension's storage and reloading

## Privacy

This extension only accesses data related to your Duolingo followers and following list. All data is stored locally on your device and is not shared with any third parties. 