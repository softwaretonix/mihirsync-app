import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OnboardingContext = createContext();

export const OnboardingProvider = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [appLanguage, setAppLanguage] = useState('gu');
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('@onboarding_complete');
      const lang = await AsyncStorage.getItem('@app_language');
      if (status === 'true') setHasCompletedOnboarding(true);
      if (lang) setAppLanguage(lang);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('@onboarding_complete', 'true');
    setHasCompletedOnboarding(true);
  };

  const changeLanguage = async (lang) => {
    await AsyncStorage.setItem('@app_language', lang);
    setAppLanguage(lang);
  };

  return (
    <OnboardingContext.Provider value={{ hasCompletedOnboarding, completeOnboarding, appLanguage, changeLanguage, isLoadingContext }}>
      {children}
    </OnboardingContext.Provider>
  );
};