import { createSlice } from '@reduxjs/toolkit';

const getTodayDate = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const initialState = {
  hcp_name: '',
  hcp_id: null,
  type: 'Meeting',
  date: getTodayDate(),
  time: getCurrentTime(),
  attendees: '',
  topics_discussed: '',
  materials: [],
  samples: [],
  sentiment: 'Neutral',
  outcomes: '',
  follow_up_actions: '',
};

const interactionSlice = createSlice({
  name: 'interaction',
  initialState,
  reducers: {
    setField: (state, action) => {
      const { name, value } = action.payload;
      state[name] = value;
    },
    setFields: (state, action) => {
      return { ...state, ...action.payload };
    },
    addMaterial: (state, action) => {
      if (!state.materials.includes(action.payload)) {
        state.materials.push(action.payload);
      }
    },
    removeMaterial: (state, action) => {
      state.materials = state.materials.filter((m) => m !== action.payload);
    },
    addSample: (state, action) => {
      if (!state.samples.includes(action.payload)) {
        state.samples.push(action.payload);
      }
    },
    removeSample: (state, action) => {
      state.samples = state.samples.filter((s) => s !== action.payload);
    },
    resetForm: () => initialState,
  },
});

export const {
  setField,
  setFields,
  addMaterial,
  removeMaterial,
  addSample,
  removeSample,
  resetForm,
} = interactionSlice.actions;

export default interactionSlice.reducer;
