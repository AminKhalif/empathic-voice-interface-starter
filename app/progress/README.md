# Voice Therapy Progress Page

This page displays the patient's voice therapy progress data and provides an AI-powered chat interface to discuss results with patients and healthcare providers.

## Features

1. **Weekly Stats**: Shows a summary of the patient's weekly activity, including:
   - Number of exercises completed
   - Total practice time
   - Average voice strength
   - Average voice stability

2. **Progress Charts**: Visualizes the patient's progress over time with interactive charts for:
   - Voice strength trends
   - Voice stability trends

3. **AI Chat Assistant**: Provides an interactive chat interface where patients and healthcare providers can:
   - Ask questions about progress data
   - Get personalized recommendations for improvement
   - Discuss specific aspects of voice therapy
   - Receive explanations of metrics in simple terms

## Technical Implementation

- **Data Source**: Patient data is retrieved from Supabase database
- **Charts**: Built using Recharts library for responsive, interactive data visualization
- **Chat Interface**: Powered by OpenAI's GPT-4o model
- **State Management**: Uses React's useState and useEffect hooks

## API Endpoints

- `/api/progress`: Fetches patient progress data from Supabase
- `/api/chat`: Handles chat interactions with OpenAI

## Environment Variables

The following environment variables need to be set in `.env.local`:

```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## For Developers

To add new metrics or visualizations to the progress page:

1. Update the `/api/progress/route.ts` file to include additional data points
2. Add new chart components or statistics to the progress page
3. Update the system prompt in `/api/chat/route.ts` to include context about new metrics
