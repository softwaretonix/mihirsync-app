import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator, Image, SafeAreaView, StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthContext } from '../context/AuthContext';
import { OnboardingContext } from '../context/OnboardingContext';
import { translations } from '../utils/translations';
import { AppConfig } from '../utils/config';

export default function OnboardingFlow() {
  const { signInWithGoogle } = useContext(AuthContext);
  const { completeOnboarding, changeLanguage, appLanguage } = useContext(OnboardingContext);
  
  // Steps: 0=Splash, 1=GoogleLogin, 2=Language, 3=Welcome, 4=Notification
  const [step, setStep] = useState(0); 
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // 🔴 Premium Splash Screen Animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();

    // સ્પ્લેશ સ્ક્રીન 2 સેકન્ડ પછી ઓટોમેટિક લોગીન પર જશે
    setTimeout(() => { setStep(1); }, 2000);
  }, []);

  const handleGoogleLogin = async () => {
    const success = await signInWithGoogle();
    if (success) setStep(2);
  };

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    // જો પરમિશન મળે કે ના મળે, ઓનબોર્ડિંગ પૂરું કરી દો અને હોમ પર જાઓ
    completeOnboarding(); 
  };

  const t = translations[appLanguage];

  if (step === 0) return (
    <View style={{ flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <Image source={AppConfig.logo} style={{ width: 100, height: 100, resizeMode: 'contain', marginBottom: 20 }} />
        <Text style={{ fontSize: 32, fontWeight: '900', color: '#111' }}>Mihir<Text style={{ color: AppConfig.primaryColor }}>Sync</Text></Text>
        <ActivityIndicator color={AppConfig.primaryColor} style={{ marginTop: 40 }} />
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 30, justifyContent: 'center' }}>
        
        {step === 1 && (
          <View>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#111', marginBottom: 10 }}>Welcome to MihirSync</Text>
            <Text style={{ fontSize: 16, color: '#6B7280', marginBottom: 50, lineHeight: 24 }}>Your personalized news experience, all in one place.</Text>
            
            <TouchableOpacity onPress={handleGoogleLogin} style={{ backgroundColor: '#111', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Continue with Google</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setStep(2)} style={{ padding: 18, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: 'bold' }}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#111', marginBottom: 40 }}>Choose your language</Text>
            {['gu', 'hi', 'en'].map(lang => (
              <TouchableOpacity key={lang} onPress={() => changeLanguage(lang)} style={{ padding: 20, borderWidth: 2, borderColor: appLanguage === lang ? AppConfig.primaryColor : '#F3F4F6', borderRadius: 12, marginBottom: 15, backgroundColor: appLanguage === lang ? AppConfig.primaryColor + '10' : '#FFF' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: appLanguage === lang ? AppConfig.primaryColor : '#111', textAlign: 'center' }}>
                  {lang === 'gu' ? 'ગુજરાતી' : lang === 'hi' ? 'हिन्दी' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setStep(3)} style={{ backgroundColor: AppConfig.primaryColor, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Continue →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 36, fontWeight: '900', color: '#111', lineHeight: 50, marginBottom: 20 }}>{t.welcomeTitle}</Text>
            <Text style={{ fontSize: 20, color: '#4B5563', lineHeight: 32, marginBottom: 50 }}>{t.welcomeDesc}</Text>
            <TouchableOpacity onPress={() => setStep(4)} style={{ backgroundColor: AppConfig.primaryColor, padding: 18, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>{t.btnNext}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#111', lineHeight: 45, marginBottom: 15 }}>{t.notiTitle}</Text>
            <Text style={{ fontSize: 18, color: '#4B5563', lineHeight: 28, marginBottom: 50 }}>{t.notiDesc}</Text>
            <TouchableOpacity onPress={requestNotificationPermission} style={{ backgroundColor: AppConfig.primaryColor, padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>{t.btnNotiOn}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => completeOnboarding()} style={{ padding: 18, alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: 'bold' }}>{t.btnLater}</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}