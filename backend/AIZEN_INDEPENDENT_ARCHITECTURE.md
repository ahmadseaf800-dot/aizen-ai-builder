# Aizen AI — Independent / Local-First Architecture

## الهدف
Aizen AI Builder لا يعتمد على هوية Gemini أو Groq. طبقة Aizen الخاصة هي التي تملك الهوية، الذاكرة، تخطيط المشاريع، أدوات الوكيل، التحقق، الإصلاح، الأمان، وإدارة السياق.

النموذج نفسه قابل للاستبدال. يمكن تشغيل نموذج مفتوح المصدر خلف واجهة OpenAI-compatible مثل llama.cpp أو Ollama-compatible gateway أو vLLM.

## طبقات Aizen

1. **Aizen Core** — الهوية والقواعد والمعرفة التشغيلية.
2. **Agent Runtime** — inspect → plan → implement → review → repair → test → security → verify.
3. **Workspace** — سياق المشروع والملفات والذاكرة.
4. **Knowledge** — قاعدة معرفة قابلة للتحديث والاسترجاع، وليست نسخاً من بيانات خاصة بنموذج آخر.
5. **Local Model Adapter** — الاتصال بنموذج مستضاف ذاتياً عبر OpenAI-compatible API.
6. **Provider Router** — يسمح باستخدام مزود خارجي كحل احتياطي فقط عند الحاجة.

## الرسائل

لا يوجد عداد يومي للرسائل داخل Aizen Core أو Agent Runtime.

عدد الرسائل الفعلي تحدده موارد النموذج المحلي: RAM/VRAM/CPU/GPU، زمن التنفيذ، وسعة السياق. لذلك لا يمكن وصف النظام بأنه "لا نهائي حرفياً"؛ لكن لا يوجد حد يومي من Gemini/Groq عندما يعمل Aizen على نموذج محلي.

## المعرفة

لا يتم وضع "كل معلومات العالم" داخل ملف واحد. المعرفة المتغيرة والضخمة يجب أن تكون Retrieval/RAG قابلة للتحديث، مع مصادر وتاريخ ومراجعة.

المعرفة الأساسية المدمجة تغطي:
- Web وJavaScript وNode.js
- قواعد البيانات وPostgreSQL وSupabase
- Authentication وAuthorization وRLS
- أمن التطبيقات
- هندسة AI وRAG وAgents
- Python وJava وGo وRust وC/C++ وC# وPHP وRuby وSwift وDart وSQL وBash
- APIs وBots وWebhooks
- Apps وCloud وContainers وCI/CD
- Minecraft Java/Fabric/Paper/Purpur ومفاهيم تطوير الألعاب

## الأمان

لا يحصل النموذج على أسرار البيئة أو توكنات Telegram/Discord. التوكنات تُتحقق منها في الخادم وتُحفظ في مخزن الأسرار، بينما يرى النموذج أسماء متغيرات البيئة فقط.

صلاحيات المالك تعتمد على المصادقة في الخادم ولا يمكن الحصول عليها بكتابة رسالة مثل "أنا المالك".

## الوكيل

عند طلب تعديل مشروع، الهدف ليس إنتاج كود شكلي فقط:

```text
Inspect
  ↓
Plan
  ↓
Implement
  ↓
Review
  ↓
Repair
  ↓
Test
  ↓
Security
  ↓
Verify
```

كل زر أو ميزة جديدة يجب أن يكون لها event handler وتدفق بيانات فعلي. لا نضيف أزراراً تجميلية بلا تنفيذ.

## النموذج المحلي

الإعدادات:

```env
AI_PROVIDER=local
AIZEN_LOCAL_MODEL_URL=http://YOUR_MODEL_SERVER:PORT/v1
AIZEN_LOCAL_MODEL_NAME=YOUR_MODEL
AIZEN_LOCAL_MODEL_TIMEOUT_MS=120000
AIZEN_LOCAL_MODEL_RETRIES=2
```

إذا كان الخادم المحلي يقدم `/v1/chat/completions`، يستطيع Aizen استخدامه دون تغيير طبقة الوكيل.

## حدود واقعية

تشغيل نموذج قوي محلياً يحتاج موارد. "مستقل" يعني أن Aizen لا يعتمد على حصة رسائل مزود بعينه، وليس أن الحساب يحصل على قدرة حسابية غير محدودة مجاناً.
