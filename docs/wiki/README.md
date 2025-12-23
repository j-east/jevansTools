# jevansTools Wiki

Developer guides and documentation for projects in this repository.

## Guides

### Repository Management

- **[Working with Git Submodules](./working-with-submodules.md)** ⭐ **Start Here**
  - Understanding submodules in jevansTools
  - Cloning and initialization
  - Common workflows
  - Troubleshooting guide

### Deployment & Infrastructure

- **[Deploying to GitHub Pages](./deploying-to-github-pages.md)**
  - Complete guide to deploying frontend apps with Vite + TypeScript
  - GitHub Actions workflow setup
  - Common pitfalls and solutions
  - Based on KavaChat deployment experience

### Authentication & APIs

- **[OpenRouter OAuth Integration](./openrouter-oauth-integration.md)**
  - PKCE OAuth flow implementation
  - Frontend-only authentication
  - Security best practices
  - Complete code walkthrough
  - Troubleshooting guide

## Projects

### KavaChat (Submodule)
A retrofuture 80s themed chat application using OpenRouter API.

- **Type:** Git Submodule
- **Live Demo:** https://j-east.github.io/KavaChat/
- **Repository:** https://github.com/j-east/KavaChat
- **Tech Stack:** TypeScript, Vite, OpenRouter API
- **Features:**
  - PKCE OAuth authentication
  - Dynamic model loading
  - Streaming chat responses
  - Neon retrofuture UI

### depthmap-to-stl-2 (Submodule)
Convert depth maps to 3D STL models.

- **Type:** Git Submodule
- **Live Demo:** https://j-east.github.io/depthmap-to-stl-2/
- **Repository:** https://github.com/j-east/depthmap-to-stl-2
- **Tech Stack:** TypeScript, Three.js
- **Features:**
  - Depth map processing
  - 3D mesh generation
  - STL export

### roo-sniffer
HTTP/HTTPS proxy monitor for debugging API calls.

- **Type:** Local Directory
- **Directory:** `/roo-sniffer`
- **Tech Stack:** TypeScript, Node.js

## Contributing

These guides are based on real implementation experiences. Feel free to:
- Add new guides for other projects
- Update existing guides with improvements
- Submit corrections or clarifications
- Share your own deployment experiences

## Quick Links

- [Main README](../../README.md)
- [License](../../LICENSE)
