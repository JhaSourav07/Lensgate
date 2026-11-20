# AI Context Control (Lensgate)
### The Control Layer Between Developers and AI Coding Agents

## What is AI Context Control?

AI Context Control is a local-first platform that gives developers visibility and control over the information their AI coding agents send to and receive from AI models.

It acts like **Burp Suite for AI coding agents**, allowing developers to observe, inspect, understand and modify AI interactions before requests reach the underlying model.

It is designed to work alongside existing AI coding environments such as Antigravity, Claude Code, Cursor, Gemini CLI, OpenAI Codex and other compatible coding agents.

It is not another coding agent. It is a transparency and control layer for the AI agents developers already use.

## The Problem

AI coding agents continuously collect and process information about a project.

This includes project instructions, source code, documentation, conversation history, tool definitions, tool outputs and other contextual information.

The information influences how the AI understands a project, interprets developer instructions and generates responses.

However, developers often have very little visibility into the complete context being supplied to the AI.

An agent might misunderstand the purpose of a project, rely on outdated instructions, overlook important architectural decisions or interpret certain functionality incorrectly.

For example:

A developer is building an authorised security testing framework.

The AI develops an interpretation:

"This project is a brute-force attack tool."

But the actual project purpose is:

"This project is an authorised security testing framework for evaluating authentication resilience on systems owned by the developer or explicitly authorised for testing."

The developer should be able to see this misunderstanding, correct the project context and ensure that the corrected information reaches the AI.

Currently, much of this context is hidden behind agent implementations and provider integrations.

AI Context Control aims to make that information observable and controllable.

## How the Product Works

The platform sits between a compatible AI coding agent and its model provider.

When the agent prepares a request, the platform can capture the available request information and present it in an inspectable interface.

The developer can examine the information, understand what the AI is receiving, make corrections and forward an approved modified request.

The AI then receives the modified developer-controlled context.

This creates a transparent interaction between the developer, the coding agent and the underlying model.

## Core Product Capabilities

### 1. AI Traffic Interception

A request inspection environment that captures supported AI agent interactions.

Developers can see outgoing requests, incoming responses, request headers, message structures, model information and other available metadata.

Requests can be inspected, paused, modified, forwarded or dropped.

The platform maintains an original-versus-modified view so developers can understand exactly what has changed.

### 2. AI Context Inspector

A detailed view of the information available to the AI.

This can include:

- System and developer instructions where exposed.
- Project descriptions and rules.
- User prompts.
- Conversation history.
- Source-code context.
- Retrieved files.
- Tool definitions and tool outputs.
- Model configuration.
- Token consumption.

The purpose is to make the AI's observable input understandable instead of treating it as a black box.

### 3. Context Intelligence

An intelligent analysis layer that examines the available project information and AI interactions.

It identifies:

- Potentially incorrect project interpretations.
- Contradictory instructions.
- Outdated project descriptions.
- Missing architectural information.
- Repeated or unnecessary context.
- Conflicting assumptions.
- Information that might cause the AI to misunderstand the developer's intention.

It distinguishes verified project information from inferred interpretations and potential misunderstandings.

### 4. Context Correction

Developers can directly correct the context available to their AI agents.

For example:

**Observed AI interpretation:**

"This application is designed for brute-force attacks."

**Developer-defined project purpose:**

"This is an authorised security testing framework designed to evaluate authentication resilience in controlled and explicitly authorised environments."

The correction becomes part of the developer-controlled context and can be supplied to subsequent compatible model requests.

Developers can also add important architectural decisions, explain project functionality, clarify technical requirements and correct outdated assumptions.

### 5. Interactive Request Editor

A request editor that provides a detailed view of AI interactions.

It offers structured and raw representations of available request data.

Developers can inspect and edit relevant developer-controlled messages, compare original and modified requests, and understand how changes affect the information being supplied to the model.

It provides a familiar request interception experience similar to professional web security inspection tools.

### 6. Project Context Analyser

The platform can analyse an entire selected project directory.

It builds an understanding of the codebase, including:

- Directory structure.
- Programming languages.
- Frameworks and dependencies.
- Important source files.
- Application architecture.
- Documentation.
- Configuration.
- Existing AI instruction files.
- Relationships between project components.

This information provides a structured representation of the project that can be compared with the context exposed by connected AI agents.

### 7. Token Intelligence

The platform provides visibility into token consumption across available AI requests.

Developers can understand:

- Tokens consumed by individual messages.
- Token usage by source files.
- Instruction and conversation overhead.
- Tool definition overhead.
- Estimated context usage.
- Model-specific token estimates.
- Token consumption before and after context modifications.

It also identifies unnecessary duplication and potentially irrelevant context.

### 8. Context History

Every approved context modification can be recorded.

Developers can review previous context versions, see what the AI was previously being told, understand which corrections were applied and compare old and updated context.

This creates an auditable history of how the project's AI understanding evolves.

## Operating Experience

AI Context Control provides three levels of interaction:

**Observe**

Developers can monitor AI interactions and inspect available context without modifying requests.

**Suggest**

The platform identifies potential context problems and recommends corrections for developer approval.

**Control**

Developers can apply approved context corrections and modification rules to compatible requests, with visibility and an audit trail.

## Supported AI Ecosystem

The platform is designed as an independent layer rather than a product tied to a single AI provider.

Its intended ecosystem includes:

- Google Antigravity.
- Claude Code.
- Gemini CLI.
- Cursor.
- OpenAI Codex.
- Other compatible AI coding agents.

Each integration may expose different information and offer different levels of request control.

The platform provides a consistent experience wherever the underlying integration permits it.

## Product Identity

AI Context Control combines three concepts:

**Burp Suite:** Visibility and control over requests and responses.

**Token management:** Understanding and optimising the information consumed by AI agents.

**Context intelligence:** Understanding what the AI is being told, identifying potential misunderstandings and allowing developers to correct them.

Together, these capabilities create a new category of developer infrastructure: AI Context Management and Control.

## The Core Philosophy

AI coding agents should not be opaque systems whose project understanding developers have to blindly trust.

Developers should be able to see what information their AI receives, understand how their project is represented, identify incorrect assumptions and correct the context that influences future interactions.

**AI Context Control — See what your AI sees. Understand what it understands. Control what it receives.**

