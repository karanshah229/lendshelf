import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** AsyncStorage-backed storage for zustand `persist` (localStorage on web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
