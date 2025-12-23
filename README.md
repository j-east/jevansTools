# jevansTools

A collection of development and debugging tools by John Evans.

**Note:** This repository uses [Git Submodules](./docs/wiki/working-with-submodules.md). Clone with:
```bash
git clone --recurse-submodules https://github.com/j-east/jevansTools.git
```

## Tools

### Roo Sniffer

A TypeScript-based HTTP/HTTPS proxy for monitoring and logging API requests. Perfect for debugging VSCode extensions, monitoring API calls, and analyzing network traffic.

**Key Features:**
- HTTP/HTTPS interception with MITM capabilities
- Real-time web UI for monitoring requests
- Domain-specific watching (Anthropic, OpenAI, AWS, etc.)
- One-command debug mode for VSCode extensions
- Dynamic certificate generation for HTTPS

[View Roo Sniffer Documentation](./roo-sniffer/README.md)

### KavaChat

A retrofuture 80s themed chat application using OpenRouter API with PKCE OAuth authentication. Fully frontend-only, deployed to GitHub Pages.

**Live Demo:** [https://j-east.github.io/KavaChat/](https://j-east.github.io/KavaChat/)

**Key Features:**
- PKCE OAuth authentication (no backend required)
- Dynamic model loading from OpenRouter API
- Streaming chat responses
- Neon cyan, salmon, and gold aesthetic
- Support for GPT-4, Claude, Gemini, DeepSeek, and more

[View KavaChat Repository](https://github.com/j-east/KavaChat)

### depthmap-to-stl-2

Convert depth maps to 3D STL models in your browser.

**Live Demo:** [https://j-east.github.io/depthmap-to-stl-2/](https://j-east.github.io/depthmap-to-stl-2/)

**Key Features:**
- Depth map to 3D mesh conversion
- Real-time 3D preview
- STL file export
- Fully browser-based

[View depthmap-to-stl-2 Repository](https://github.com/j-east/depthmap-to-stl-2)

## Documentation

Check out the [**Wiki**](./docs/wiki/) for comprehensive guides:

- [**Working with Git Submodules**](./docs/wiki/working-with-submodules.md) ⭐ **Start here** - Managing submodules in this repo
- [**Deploying to GitHub Pages**](./docs/wiki/deploying-to-github-pages.md) - Complete guide to deploying Vite + TypeScript apps
- [**OpenRouter OAuth Integration**](./docs/wiki/openrouter-oauth-integration.md) - PKCE authentication implementation guide

## License

This project is licensed under the Server Side Public License (SSPL) v1. See the [LICENSE](LICENSE) file for details.

**What this means:**
- You can freely use, modify, and distribute this code
- If you offer this software as a service, you must open source all the code used to provide that service
- This prevents cloud providers from offering this as a managed service without contributing back

## Contributing

This is a personal toolkit. Feel free to fork and adapt for your own use.

## Author

John Evans
