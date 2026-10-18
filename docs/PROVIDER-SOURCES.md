# Provider 协议参考

本版预设与请求适配参考以下服务商一手文档，检查日期2026-10-18。模型 ID 是可编辑的起点，并不保证每个账户都开通这些模型；可按服务商控制台调整。没有使用真实付费 key 做在线成功率测量。

- OpenAI Chat Completions：https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- DeepSeek：https://api-docs.deepseek.com/
- Claude Messages：https://platform.claude.com/docs/en/api/messages/create
- Gemini OpenAI compatibility：https://ai.google.dev/gemini-api/docs/openai
- Qwen OpenAI compatibility：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- Kimi：https://platform.kimi.com/docs/get-api-key
- SiliconFlow：https://docs.siliconflow.cn/docs/api/chat-completions-post
- Ollama：https://docs.ollama.com/api/openai-compatibility
- Tavily：https://docs.tavily.com/documentation/api-reference/endpoint/search
- Brave：https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
- Serper：https://serper.dev/
- SerpAPI：https://serpapi.com/search-api
- Exa：https://exa.ai/docs/reference/search

自定义服务需遵守 INTEGRATION-v0.2.0.md 规定的协议。OpenAI 兼容不表示所有模型都支持同一组参数；本实现不发送 temperature 等可能不被推理模型接受的参数。
