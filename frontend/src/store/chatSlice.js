import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [
    {
      role: 'assistant',
      content:
        'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.',
    },
  ],
  loading: false,
  suggestedFollowups: [],
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setSuggestedFollowups: (state, action) => {
      state.suggestedFollowups = action.payload;
    },
    clearChat: (state) => {
      state.messages = initialState.messages;
      state.suggestedFollowups = [];
      state.loading = false;
    },
  },
});

export const { addMessage, setLoading, setSuggestedFollowups, clearChat } =
  chatSlice.actions;

export default chatSlice.reducer;
