# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal users who want a private conversational assistant for questions, writing, documents, and everyday research.

## Product Purpose

Friend provides a persistent chat interface for an AI assistant. Success means a user can sign in, continue a conversation, and choose whether inference runs locally or through a configured hosted provider.

## Positioning

Local-first assistant: Ollama is the default inference provider, with an OpenAI-compatible provider option for hosted deployments. The local Ollama instance must not be exposed publicly to make a hosted deployment work.

## Operating Context

Users work in a web browser on desktop or mobile. They can revisit or delete conversations, attach PDFs and images, and use browser-native speech input and output where supported.

## Capabilities and Constraints

- React client, Express/Node.js API, SQLite persistence, and an MVC-oriented server structure.
- Account authentication, per-user conversation and memory isolation, streaming replies, and an administrator role.
- PDF text extraction and image forwarding require a compatible model; the hosted provider is configured with deployment environment variables.
- Voice recognition and synthesis depend on browser support. PDF export uses the browser print dialog and its “Save as PDF” option.
- SQLite and uploaded files need persistent storage in hosted environments.
- Registration can be disabled. An administrator is provisioned from environment variables at first startup.
- The application does not execute arbitrary plugin code; extensions add administrator-managed prompt instructions.

## Brand Commitments

The name is Friend. The selected interface direction is dark, minimal, and warm, with a matching light theme available.

## Evidence on Hand

No customer testimonials, performance benchmarks, or external certifications were supplied. Do not invent them.

## Product Principles

- Keep personal conversations private and scoped to their owner.
- Prefer local inference without making it a deployment requirement.
- Make the model provider and its limitations visible.
- Preserve user control over history and saved memory.
