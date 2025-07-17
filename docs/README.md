# TON License Oracle Bot

A Telegram bot that verifies driver licenses using AI-powered OCR and records verification results on the TON blockchain with OpenServ multi-agent integration.

## Features

- **Multi-Agent AI**: Dynamic agent discovery from OpenServ workspace
- **License OCR**: Advanced image processing with Tesseract.js and Sharp
- **TON Blockchain**: Real transaction recording with verified hashes
- **Oracle System**: Smart license verification and validation

## Quick Start

### Prerequisites

- Node.js 16+
- Telegram Bot Token
- OpenServ API Key + Workspace access
- TON API Key (optional)

### Installation

```bash
git clone <repository-url>
cd simple-telegram-openserv-bot
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENSERV_API_KEY=your_openserv_api_key
WORKSPACE_ID=your_workspace_id
AGENT_ID=default_agent_id
TON_API_KEY=your_ton_api_key
TON_MNEMONIC="your 24 word mnemonic phrase"
```

## Usage

### AI Commands

- `/start` - Initialize bot
- `/ask [question]` - Ask current AI agent
- `/agent` - Switch between agents
- `/agents` - List all workspace agents

### License Verification

- `/setwallet [TON_ADDRESS]` - Set wallet address
- **Send photo** - Upload license for verification
- `/license` - Check your license status
- `/export` - Export data

### Blockchain

- `/wallet` - Check TON wallet status

## Architecture

```
src/
├── blockchain/TONIntegration.ts     # TON blockchain operations
├── bot/TelegramBot.ts               # Telegram bot handlers
├── config/Environment.ts            # Configuration management
├── database/                        # Data storage
├── ocr/OCRProcessor.ts              # Image processing
├── openserv/AgentManager.ts         # Dynamic agent management
├── oracle/LicenseOracle.ts          # License verification
├── types/                           # TypeScript interfaces
└── utils/                           # Utilities
```

## Key Components

- **AgentManager**: OpenServ workspace integration with smart caching
- **TONIntegration**: Real blockchain transactions with confirmation
- **OCRProcessor**: Multi-stage image enhancement and text extraction
- **LicenseOracle**: Business logic for license validation

## Blockchain Integration

All license verifications are recorded as real transactions on TON testnet:

- Explorer-verifiable transaction hashes
- Seqno-based confirmation waiting
- Immutable blockchain storage

## Security

- Environment-only mnemonic storage
- Hash-only blockchain data
- Temporary file cleanup
- Secure API communication

## License

MIT License
