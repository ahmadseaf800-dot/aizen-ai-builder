# Aizen Local Model Catalog

Aizen's orchestration layer is model-independent. Choose the model according to the server's RAM/VRAM.

## Default

`qwen2.5-coder:3b` — lightweight coding model for low-resource testing.

## Better coding quality

`qwen2.5-coder:7b` — stronger coding/reasoning, requires substantially more memory.

## Larger deployments

Use a current open-source coding/reasoning model compatible with Ollama/OpenAI-compatible APIs and benchmark it against Aizen's own test suite before switching production defaults.

## Important

A local model does not create literally infinite computation. It removes third-party provider message quotas; throughput and context remain limited by the model and hardware.

Aizen should use:

`request -> agent context -> local model -> tool/action validation -> project changes -> review -> verification`

Never grant a model unrestricted operating-system access. Expose only explicit, authenticated project tools.
