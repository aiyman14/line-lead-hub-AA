# ProductionPortal AI Chat Assistant

This document describes the AI chat assistant feature for ProductionPortal, including setup, configuration, and how to manage the knowledge base.

## Overview

The chat assistant helps users with:
- Understanding how to use ProductionPortal features
- Answering questions about factory compliance and certifications
- Troubleshooting issues
- Providing links to relevant documentation

Key features:
- **RAG (Retrieval Augmented Generation)**: Answers are grounded in your knowledge base documents
- **Citations**: Every factual claim includes source citations
- **Role-based access**: Responses are tailored to what the user can access
- **Multilingual**: Supports English and Bengali with auto-detection
- **No hallucinations**: The assistant refuses to answer if evidence isn't found

## Architecture

### Components

1. **Frontend**
   - `ChatWidget`: Floating button + chat panel (bottom-right)
   - `ChatPanel`: Message list, input, and controls
   - `ChatMessage`: Individual message with citations
   - `useChat` hook: State management for chat

2. **Edge Functions**
   - `chat`: Main chat endpoint with RAG
   - `ingest-document`: Document ingestion with chunking + embeddings
   - `get-source`: Fetch full source content for citations
   - `chat-feedback`: Record thumbs up/down feedback

3. **Database Tables**
   - `knowledge_documents`: Document metadata
   - `knowledge_chunks`: Text chunks with vector embeddings
   - `chat_conversations`: User conversations
   - `chat_messages`: Individual messages with citations
   - `chat_analytics`: Usage analytics and feedback
   - `role_feature_access`: Maps roles to features for access control

## Environment Variables

Add these to your Supabase Edge Functions secrets:

```bash
# Required for embeddings
OPENAI_API_KEY=sk-...

# Required for chat responses
ANTHROPIC_API_KEY=sk-ant-...

# Already configured
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Setup Instructions

### 1. Run Database Migration

Apply the migration to create necessary tables:

```bash
supabase db push
# or
supabase migration up
```

### 2. Deploy Edge Functions

```bash
supabase functions deploy chat
supabase functions deploy ingest-document
supabase functions deploy get-source
supabase functions deploy chat-feedback
```

### 3. Set Environment Variables

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Add Initial Documents

1. Navigate to **Setup > Knowledge Base** in the admin panel
2. Click **Add Document**
3. Fill in the document details
4. Paste the content (or provide a source URL)
5. Click **Add & Ingest**

## Managing the Knowledge Base

### Adding Documents

1. Go to **Setup > Knowledge Base**
2. Click **Add Document**
3. Fill in:
   - **Title**: Descriptive name
   - **Type**: manual, tutorial, certificate, readme, faq, policy
   - **Language**: en (English) or bn (Bengali)
   - **Content**: Full text of the document
   - **Source URL**: Optional link to original
   - **Global**: Check if visible to all factories

### Document Types

| Type | Use For |
|------|---------|
| `manual` | User manuals and guides |
| `tutorial` | Step-by-step tutorials, video descriptions |
| `certificate` | Compliance certificates (GOTS, GRS, BSCI, etc.) |
| `readme` | Quick start guides, README files |
| `faq` | Frequently asked questions |
| `policy` | Company policies, procedures |

### Updating Documents

1. Delete the existing document
2. Re-add with updated content
3. Or click the refresh icon to re-ingest

### Best Practices

- **Chunk naturally**: The system auto-chunks, but well-structured content (headings, paragraphs) works best
- **Be specific**: Include specific feature names, button labels, menu paths
- **Keep current**: Update documents when features change
- **Add context**: Include "what" and "why", not just "how"
- **Test coverage**: Use Chat Analytics to find gaps

## Viewing Analytics

Navigate to **Setup > Chat Analytics** to see:

- Total questions asked
- Unanswered questions (no evidence found)
- Positive/negative feedback
- Question log with filters

### Improving Coverage

1. Review "Unanswered" questions in analytics
2. Add or update documents to cover common topics
3. Monitor "Negative" feedback for quality issues

## Role-Based Access

The assistant automatically filters responses based on user role:

| Role | Can Ask About |
|------|---------------|
| `worker` | Sewing/finishing forms, submissions, blockers |
| `admin` | All features including setup, users, analytics |
| `owner` | Everything including billing |
| `storage` | Storage bin cards, transactions |
| `cutting` | Cutting targets, submissions |

If a user asks about features they can't access, the assistant explains they need different permissions.

## Safety Rules

The assistant follows strict safety rules:

1. **No hallucinations**: Only answers with evidence from sources
2. **Conservative compliance**: Suggests contacting compliance for legal questions
3. **No secrets exposure**: Never reveals API keys or internal data
4. **Cites sources**: Always includes document references

## Troubleshooting

### Chat not loading
- Check browser console for errors
- Verify edge functions are deployed
- Check CORS configuration includes your domain

### No responses / API errors
- Verify ANTHROPIC_API_KEY is set correctly
- Check edge function logs: `supabase functions logs chat`

### Poor answer quality
- Add more relevant documents
- Improve document structure (clear headings)
- Check embedding quality in `knowledge_chunks`

### "No evidence" for valid questions
- Document may not be ingested - check status in Knowledge Base
- Re-ingest the document
- Add more specific content covering the topic

## API Reference

### POST /functions/v1/chat

Send a chat message.

**Request:**
```json
{
  "message": "How do I submit morning targets?",
  "conversation_id": "optional-uuid",
  "language": "en"
}
```

**Response:**
```json
{
  "message": "To submit morning targets...",
  "citations": [
    {
      "chunkId": "uuid",
      "documentTitle": "User Manual",
      "snippet": "..."
    }
  ],
  "conversation_id": "uuid",
  "no_evidence": false,
  "language": "en"
}
```

### POST /functions/v1/ingest-document

Ingest a document (admin only).

**Request:**
```json
{
  "document_id": "uuid",
  "content": "Full document text..."
}
```

### POST /functions/v1/chat-feedback

Submit feedback on a response.

**Request:**
```json
{
  "message_id": "uuid",
  "feedback": "thumbs_up",
  "comment": "Optional comment"
}
```

## Costs

- **OpenAI Embeddings**: ~$0.02 per 1M tokens (very low cost)
- **Claude API**: ~$3 per 1M input tokens, $15 per 1M output tokens
- Typical conversation: $0.01-0.05 depending on length

## Future Improvements

- [ ] PDF parsing for direct file upload
- [ ] Scheduled re-ingestion for URL-based docs
- [ ] Conversation history view
- [ ] Export analytics to CSV
- [ ] Custom training on factory-specific terminology
