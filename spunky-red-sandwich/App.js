// App.js
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, StatusBar, Share, Linking, TextInput, Switch, Modal, Platform, Alert, BackHandler, RefreshControl } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './src/services/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { AppConfig } from './src/utils/config';

// 🔴 AdMob Imports Update Karya
import { BannerAd, BannerAdSize, TestIds, useInterstitialAd, useAppOpenAd } from 'react-native-google-mobile-ads';

import CategoryScreen from './src/screens/CategoryScreen';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { OnboardingProvider, OnboardingContext } from './src/context/OnboardingContext';
import OnboardingFlow from './src/screens/OnboardingFlow';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('નોટિફિકેશનની પરમિશન નથી મળી!');
      return null;
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId: 'ad21f3f6-90b1-418d-9ce2-25a8d31c8178' })).data;
  }
  return token;
}

const translateText = async (text, targetLang) => {
  if (!text || targetLang === 'gu') return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=gu&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result[0].map(item => item[0]).join('');
  } catch (error) {
    console.error("Translation Error: ", error);
    return text;
  }
};

const uiText = {
  gu: { home: 'હોમ', cat: 'વિભાગો', saved: 'સેવેલા', search: 'ન્યૂઝ શોધો...', breaking: 'બ્રેકિંગ ન્યૂઝ', readMore: 'વધુ ન્યૂઝ માટે અહીં ક્લિક કરો 🌐', noNews: 'કોઈ ન્યૂઝ મળ્યા નથી.', minRead: 'મિનિટ રીડ', share: 'શેર કરો', savedNews: 'સેવ કરેલા ન્યૂઝ 🔖', allCat: 'બધા વિભાગો', logoutMsg: 'શું તમે ખરેખર લોગઆઉટ કરવા માંગો છો?', yes: 'હા, બહાર નીકળો', no: 'ના, કેન્સલ કરો', darkMode: 'ડાર્ક મોડ', logout: 'લોગઆઉટ', language: 'ભાષા (Language)', changeLang: 'તમારી ભાષા પસંદ કરો', notifications: 'નોટિફિકેશન (Notifications)' },
  hi: { home: 'होम', cat: 'श्रेणियां', saved: 'सहेजे गए', search: 'खोजें...', breaking: 'ब्रेकिंग न्यूज़', readMore: 'अधिक समाचार के लिए यहाँ क्लिक करें 🌐', noNews: 'कोई खबर नहीं मिली।', minRead: 'मिनट पढ़ें', share: 'शेयर', savedNews: 'सहेजी गई खबरें 🔖', allCat: 'सभी श्रेणियां', logoutMsg: 'क्या आप वाकई लॉगआउट करना चाहते हैं?', yes: 'हाँ, लॉगआउट करें', no: 'रद्द करें', darkMode: 'डार्क मोड', logout: 'लॉगआउट', language: 'भाषा (Language)', changeLang: 'अपनी भाषा चुनें', notifications: 'नोटिफिकेशन (Notifications)' },
  en: { home: 'Home', cat: 'Categories', saved: 'Saved', search: 'Search news...', breaking: 'Breaking News', readMore: 'Click Here For More News 🌐', noNews: 'No news found.', minRead: 'Min Read', share: 'Share', savedNews: 'Saved News 🔖', allCat: 'All Categories', logoutMsg: 'Are you sure you want to logout?', yes: 'Yes, Logout', no: 'Cancel', darkMode: 'Dark Mode', logout: 'Logout', language: 'Language', changeLang: 'Choose your language', notifications: 'Notifications' }
};

const cleanHTMLContent = (htmlString) => {
  if (!htmlString) return "";
  let text = htmlString.replace(/<br\s*[\/]?>/gi, '\n\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n').trim();
  return text;
};

function MainApp() {
  const { user, savedArticles, toggleSave, logout, signInWithGoogle } = useContext(AuthContext);
  const { appLanguage, changeLanguage } = useContext(OnboardingContext);
  
  const [currentTab, setCurrentTab] = useState('Home');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [headerCategories, setHeaderCategories] = useState([{ id: 'home', name: 'Home' }]); 
  const [activeCategory, setActiveCategory] = useState('Home');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const [isConnected, setIsConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedSocial, setExpandedSocial] = useState(null);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  // 🔴 AdMob Full Screen & App Open Setup
  const appOpenAdUnitId = __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-9566636476372749/6920079171';
  const interstitialAdUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-9566636476372749/5854323794';

  const { isLoaded: isAppOpenLoaded, load: loadAppOpen, show: showAppOpen } = useAppOpenAd(appOpenAdUnitId, { requestNonPersonalizedAdsOnly: true });
  const { isLoaded: isInterstitialLoaded, isClosed: isInterstitialClosed, load: loadInterstitial, show: showInterstitial } = useInterstitialAd(interstitialAdUnitId, { requestNonPersonalizedAdsOnly: true });

  useEffect(() => {
    loadAppOpen();
    loadInterstitial();
  }, [loadAppOpen, loadInterstitial]);

  useEffect(() => {
    if (isAppOpenLoaded) {
      showAppOpen();
    }
  }, [isAppOpenLoaded]);

  useEffect(() => {
    if (isInterstitialClosed) {
      loadInterstitial();
    }
  }, [isInterstitialClosed, loadInterstitial]);

  const t = uiText[appLanguage] || uiText['gu'];

  const theme = {
    bg: isDarkMode ? '#121212' : '#FFF',
    header: isDarkMode ? '#121212' : '#FFF', 
    cardBg: isDarkMode ? '#1E1E1E' : '#FFF',
    text: isDarkMode ? '#F3F4F6' : '#111',
    textMuted: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? '#2D3748' : '#F3F4F6',
    bottomNav: isDarkMode ? '#1E1E1E' : '#FFF',
    inputBg: isDarkMode ? '#2D3748' : '#F3F4F6',
    modalOverlay: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)'
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@dark_mode').then(val => { if (val === 'true') setIsDarkMode(true); });
    AsyncStorage.getItem('@notifications_enabled').then(val => { if (val !== null) setIsNotificationsEnabled(val === 'true'); });
  }, []);

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem('@dark_mode', newMode.toString());
  };

  const toggleNotifications = async () => {
    const newStatus = !isNotificationsEnabled;
    setIsNotificationsEnabled(newStatus);
    await AsyncStorage.setItem('@notifications_enabled', newStatus.toString());

    if (user) {
      if (newStatus) {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          updateDoc(doc(db, 'users', user.uid), { pushToken: token }).catch(e => console.log(e));
        }
      } else {
        updateDoc(doc(db, 'users', user.uid), { pushToken: "" }).catch(e => console.log(e));
      }
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (selectedArticle) {
        setSelectedArticle(null);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedArticle]);

  useEffect(() => {
    if (user && isNotificationsEnabled) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          updateDoc(doc(db, 'users', user.uid), { pushToken: token }).catch(e => console.log(e));
        }
      });
    }
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setLoading(true);
      const rawNewsList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        let formattedDate = 'Just now';
        if (data.createdAt) {
          const dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          formattedDate = `${dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} ${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
        }

        const rawContent = data.translations?.gu?.content || data.content || '';
        const cleanContent = cleanHTMLContent(rawContent);
        let summary = data.translations?.gu?.shortDescription || data.translations?.gu?.seoDescription || data.shortDescription || data.seoDescription || '';
        if (!summary && cleanContent.length > 0) summary = cleanContent.substring(0, 200) + '...';

        rawNewsList.push({
          id: doc.id,
          originalTitle: data.title || '', 
          originalCategory: data.category || '',
          title: data.translations?.gu?.title || data.title || t.breaking,
          shortDescription: summary,
          image: data.featuredImage || 'https://via.placeholder.com/400x200',
          category: data.category || 'News',
          time: formattedDate,
          author: data.author || 'MihirSync Editorial',
          content: cleanContent,
          views: data.stats?.views || 0
        });
      });

      if (appLanguage !== 'gu') {
        const translatedList = await Promise.all(rawNewsList.map(async (item) => {
          return {
            ...item,
            title: await translateText(item.title, appLanguage),
            category: await translateText(item.category, appLanguage),
          };
        }));
        setNews(translatedList);
      } else {
        setNews(rawNewsList);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appLanguage]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const cats = [{ id: 'home', name: t.home }]; 
      const rawCats = [];
      snapshot.forEach(doc => rawCats.push({ id: doc.id, name: doc.data().name }));

      if (appLanguage !== 'gu') {
        const translatedCats = await Promise.all(rawCats.map(async (cat) => ({ ...cat, name: await translateText(cat.name, appLanguage) })));
        setHeaderCategories([...cats, ...translatedCats]);
      } else {
        setHeaderCategories([...cats, ...rawCats]);
      }
    });
    return () => unsubscribe();
  }, [appLanguage]);

  const openArticle = async (article) => {
    // 🔴 News open karta pahela Interstitial Ad batavse
    if (isInterstitialLoaded) {
      try {
        showInterstitial();
      } catch (error) {
        console.log("Interstitial show error", error);
      }
    }

    setIsTranslating(true);
    let finalContent = article.content;
    let finalShortDesc = article.shortDescription;

    if (appLanguage !== 'gu') {
      finalContent = await translateText(article.content, appLanguage);
      finalShortDesc = await translateText(article.shortDescription, appLanguage);
    }

    setSelectedArticle({ ...article, content: finalContent, shortDescription: finalShortDesc });
    setIsTranslating(false);

    try { await updateDoc(doc(db, 'articles', article.id), { 'stats.views': increment(1) }); } 
    catch (error) { console.error(error); }
  };

  const handleShare = async (article) => {
    try { await Share.share({ message: `*${article.title}*\n\nRead more on MihirSync App.\nhttps://mihirsync-news-9nvx.vercel.app/gu` }); } 
    catch (error) { console.error(error); }
  };

  const handleSupportEmail = (type) => {
    const email = 'mihirsync1@gmail.com';
    const subject = type === 'bug' ? 'Bug Report: MihirSync App' : 'App Support: MihirSync App';
    const body = type === 'bug' ? 'Please describe the bug or problem you found in the app:\n\n' : 'How can we help you?\n\n';
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t.logoutMsg)) logout();
    } else {
      Alert.alert('Logout', t.logoutMsg, [
        { text: t.no, style: 'cancel' },
        { text: t.yes, onPress: logout, style: 'destructive' }
      ]);
    }
  };

  let displayNews = news;
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    displayNews = news.filter(item => 
      (item.title && item.title.toLowerCase().includes(q)) || 
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
      (item.originalCategory && item.originalCategory.toLowerCase().includes(q))
    );
  } else if (activeCategory !== 'Home' && activeCategory !== t.home) {
    displayNews = news.filter(item => item.category && item.category.toLowerCase() === activeCategory.toLowerCase());
  }

  const renderHeader = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: theme.header, borderBottomWidth: 1, borderColor: theme.border }}>
      {isSearching ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: theme.inputBg, borderRadius: 8, paddingHorizontal: 10 }}>
          <Feather name="search" size={20} color={theme.textMuted} />
          <TextInput autoFocus placeholder={t.search} placeholderTextColor={theme.textMuted} value={searchQuery} onChangeText={setSearchQuery} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, color: theme.text, outlineStyle: 'none' }} />
          <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}><Feather name="x" size={20} color={theme.text} /></TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={AppConfig.logo} style={{ width: 32, height: 32, resizeMode: 'contain' }} />
            <Text style={{ fontSize: 22, fontWeight: '900', color: isDarkMode ? '#FFF' : '#000', marginLeft: 8 }}>Mihir<Text style={{ color: '#EF4444' }}>Sync</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setIsSearching(true)}><Feather name="search" size={22} color={theme.text} /></TouchableOpacity>
            <TouchableOpacity><Feather name="bell" size={22} color={theme.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentTab('Profile')}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: user ? AppConfig.primaryColor + '20' : theme.inputBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: user ? AppConfig.primaryColor : theme.border }}>
                <Feather name="user" size={18} color={user ? AppConfig.primaryColor : theme.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const ProfileMenuItem = ({ icon, title, value, onPress, isSwitch, switchValue, onSwitchToggle, textColor, isExpandable, isExpanded }) => (
    <TouchableOpacity onPress={isSwitch ? null : onPress} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderColor: theme.border}}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Feather name={icon} size={20} color={textColor || theme.textMuted} />
        <Text style={{fontSize: 16, marginLeft: 15, color: textColor || theme.text, fontWeight: 'bold'}}>{title}</Text>
      </View>
      {isSwitch ? (
        <Switch value={switchValue} onValueChange={onSwitchToggle} trackColor={{ true: AppConfig.primaryColor }} />
      ) : isExpandable ? (
        <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={18} color={theme.textMuted} />
      ) : value ? (
        <View style={{flexDirection: 'row', alignItems: 'center'}}><Text style={{color: theme.textMuted, marginRight: 5, fontWeight: 'bold'}}>{value}</Text><Feather name="chevron-right" size={18} color={theme.textMuted} /></View>
      ) : (
        !textColor && <Feather name="chevron-right" size={18} color={theme.textMuted} />
      )}
    </TouchableOpacity>
  );

  if (selectedArticle) {
    const isSaved = savedArticles.find(a => a.id === selectedArticle.id);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.header, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.header} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderColor: theme.border, backgroundColor: theme.header }}>
          <TouchableOpacity onPress={() => setSelectedArticle(null)} style={{ padding: 5, paddingRight: 10 }}>
            <Feather name="arrow-left" size={26} color={theme.text} />
          </TouchableOpacity>
          <Image source={AppConfig.logo} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
          <Text style={{ fontSize: 18, fontWeight: '900', color: isDarkMode ? '#FFF' : '#000', marginLeft: 5 }}>Mihir<Text style={{ color: '#EF4444' }}>Sync</Text></Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => handleShare(selectedArticle)} style={{ padding: 5 }}><Feather name="share-2" size={22} color={theme.text} /></TouchableOpacity>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: theme.cardBg }}>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: 'bold' }}>{t.home}</Text>
                <Feather name="chevron-right" size={14} color={theme.textMuted} style={{ marginHorizontal: 5 }} />
                <Text style={{ color: AppConfig.primaryColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>{selectedArticle.category}</Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, lineHeight: 44, marginBottom: 15, letterSpacing: -0.5 }}>{selectedArticle.title}</Text>
              {selectedArticle.shortDescription ? <Text style={{ fontSize: 18, color: theme.textMuted, lineHeight: 30, marginBottom: 20, fontStyle: 'italic' }}>{selectedArticle.shortDescription}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 15, paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: AppConfig.primaryColor, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>M</Text></View>
                  <View style={{ marginLeft: 10 }}><Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>{selectedArticle.author}</Text><Text style={{ fontSize: 10, color: AppConfig.primaryColor }}>Premium Editor</Text></View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Feather name="calendar" size={14} color={theme.textMuted} /><Text style={{ color: theme.textMuted, fontSize: 12 }}>{selectedArticle.time}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Feather name="clock" size={14} color={theme.textMuted} /><Text style={{ color: theme.textMuted, fontSize: 12 }}>3 {t.minRead}</Text></View>
              </View>
            </View>
            <Image source={{ uri: selectedArticle.image }} style={{ width: '100%', aspectRatio: 16/9, backgroundColor: theme.inputBg }} resizeMode="cover" />
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 25, gap: 15 }}>
                <TouchableOpacity onPress={() => toggleSave(selectedArticle)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isSaved ? AppConfig.primaryColor : theme.inputBg, justifyContent: 'center', alignItems: 'center' }}><Feather name="bookmark" size={18} color={isSaved ? '#FFF' : theme.textMuted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleShare(selectedArticle)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDarkMode ? '#FFF' : '#111', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 }}><Feather name="share-2" size={16} color={isDarkMode ? '#111' : '#FFF'} /><Text style={{ color: isDarkMode ? '#111' : '#FFF', fontWeight: 'bold', fontSize: 14 }}>{t.share}</Text></TouchableOpacity>
              </View>
              <Text style={{ fontSize: 19, color: theme.text, lineHeight: 34, textAlign: 'justify', letterSpacing: 0.2 }}>{selectedArticle.content || t.noNews}</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://mihirsync-news-9nvx.vercel.app/gu')} style={{ backgroundColor: AppConfig.primaryColor + '15', borderColor: AppConfig.primaryColor, borderWidth: 1, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
                <Text style={{ color: AppConfig.primaryColor, fontWeight: '900', fontSize: 16 }}>{t.readMore}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* 🔴 ગૂગલ ની એડ અહી પણ મૂકી છે (આર્ટિકલ ની નીચે) */}
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <BannerAd
              unitId={__DEV__ ? TestIds.BANNER : 'ca-app-pub-9566636476372749/1655224331'}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              requestOptions={{
                requestNonPersonalizedAdsOnly: true,
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.header, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.header} />
      {currentTab !== 'Category' && renderHeader()}

      <Modal animationType="slide" transparent={true} visible={languageModalVisible} onRequestClose={() => setLanguageModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.modalOverlay }}>
          <View style={{ width: '100%', backgroundColor: theme.cardBg, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -10 } }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>{t.changeLang}</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}><Feather name="x" size={24} color={theme.textMuted} /></TouchableOpacity>
            </View>
            {['gu', 'hi', 'en'].map(lang => (
              <TouchableOpacity 
                key={lang} 
                onPress={() => { changeLanguage(lang); setLanguageModalVisible(false); }} 
                style={{ padding: 18, borderWidth: 2, borderColor: appLanguage === lang ? AppConfig.primaryColor : theme.border, borderRadius: 12, marginBottom: 15, backgroundColor: appLanguage === lang ? AppConfig.primaryColor + '15' : theme.inputBg }}
              >
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: appLanguage === lang ? AppConfig.primaryColor : theme.text, textAlign: 'center' }}>
                  {lang === 'gu' ? 'ગુજરાતી' : lang === 'hi' ? 'हिन्दी' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={privacyModalVisible || termsModalVisible} onRequestClose={() => {setPrivacyModalVisible(false); setTermsModalVisible(false);}}>
        <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: theme.border, backgroundColor: theme.header, elevation: 3 }}>
            <TouchableOpacity onPress={() => {setPrivacyModalVisible(false); setTermsModalVisible(false);}} style={{ padding: 5 }}>
              <Feather name="x" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 15 }}>{privacyModalVisible ? 'Privacy Policy' : 'Terms & Conditions'}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
            {privacyModalVisible ? (
              <>
                <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text, marginBottom: 10 }}>Privacy Policy</Text>
                <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: 'bold', marginBottom: 20 }}>Last updated: October 2026</Text>
                
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  Welcome to <Text style={{fontWeight: 'bold'}}>MihirSync</Text>. We respect your privacy and are committed to protecting your personal data. This comprehensive privacy policy will inform you as to how we look after your personal data when you use our mobile application, regardless of where you visit it from, and tell you about your privacy rights and how the law protects you.
                </Text>
                
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>1. The Data We Collect About You</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  Personal data, or personal information, means any information about an individual from which that person can be identified. We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
                  {"\n\n"}• <Text style={{fontWeight: 'bold'}}>Identity Data:</Text> includes your first name, last name, username, and profile picture.
                  {"\n"}• <Text style={{fontWeight: 'bold'}}>Contact Data:</Text> includes your email address (collected securely via <Text style={{color: AppConfig.primaryColor, fontWeight: 'bold'}} onPress={() => Linking.openURL('https://policies.google.com/privacy')}>Google Sign-In</Text>).
                  {"\n"}• <Text style={{fontWeight: 'bold'}}>Technical Data:</Text> includes internet protocol (IP) address, browser type, time zone setting, and device information.
                </Text>
                
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>2. Third-Party Services & Advertising</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  We use highly secure third-party services to help us operate our business. To keep our application free for users, we monetize our content using <Text style={{color: AppConfig.primaryColor, fontWeight: 'bold'}} onPress={() => Linking.openURL('https://policies.google.com/technologies/ads')}>Google AdMob</Text>. AdMob may use advertising cookies and tracking technologies to serve personalized ads based on your interests and previous interactions. Our backend infrastructure and user databases are securely managed and hosted by <Text style={{color: AppConfig.primaryColor, fontWeight: 'bold'}} onPress={() => Linking.openURL('https://firebase.google.com/support/privacy')}>Google Firebase</Text>.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>3. Data Security & Retention</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  We have put in place appropriate and advanced security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. We limit access to your personal data to those employees and agents who have a business need to know. We will only retain your personal data for as long as reasonably necessary to fulfill the purposes we collected it for.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>4. Your Legal Rights</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  Under certain circumstances, you have rights under global data protection laws in relation to your personal data. You have the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data, and to entirely delete your account from our systems at any time.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>5. Contact Us</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 60 }}>
                  If you have any questions about this privacy policy or our privacy practices, please contact our legal and support team at <Text style={{color: AppConfig.primaryColor, fontWeight: 'bold'}} onPress={() => Linking.openURL('mailto:mihirsync1@gmail.com')}>mihirsync1@gmail.com</Text>.
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text, marginBottom: 10 }}>Terms & Conditions</Text>
                <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: 'bold', marginBottom: 20 }}>Last updated: October 2026</Text>
                
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  Welcome to MihirSync! These terms and conditions outline the rules and regulations for the use of MihirSync's Mobile Application and all associated digital properties.
                </Text>
                
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>1. License to Use</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  By accessing this app, we assume you accept these terms and conditions in full. Do not continue to use MihirSync if you do not agree to take all of the terms and conditions stated on this page. Unless otherwise stated, MihirSync and/or its licensors own the intellectual property rights for all material and news content on MihirSync. All intellectual property rights are reserved.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>2. User Responsibilities</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  You must not republish material from MihirSync, sell, rent or sub-license material, reproduce, duplicate or copy material, or redistribute content without proper authorization from our editorial team. You are strictly responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your Google account.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>3. Advertising and Monetization</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  This application displays third-party advertisements served by <Text style={{color: AppConfig.primaryColor, fontWeight: 'bold'}} onPress={() => Linking.openURL('https://policies.google.com/technologies/ads')}>Google AdMob</Text>. By using this app, you agree to the display of such ads. We are not responsible for the content of third-party advertisements, the websites they link to, or the products/services they promote.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>4. Limitation of Liability</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 15 }}>
                  In no event shall MihirSync, nor any of its officers, directors, and employees, be held liable for anything arising out of or in any way connected with your use of this app. MihirSync shall not be held liable for any indirect, consequential, or special liability arising out of or in any way related to your use of this news application.
                </Text>

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 8 }}>5. Governing Law & Jurisdiction</Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 26, marginBottom: 60 }}>
                  These Terms will be governed by and interpreted in accordance with the laws of India, and you submit to the non-exclusive jurisdiction of the state and federal courts located in Surat, Gujarat for the resolution of any disputes.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={logoutModalVisible} onRequestClose={() => setLogoutModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.modalOverlay, padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: theme.cardBg, borderRadius: 20, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Feather name="log-out" size={30} color="#EF4444" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text, marginBottom: 10 }}>{t.logout}</Text>
            <Text style={{ fontSize: 16, color: theme.textMuted, textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>{t.logoutMsg}</Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 15 }}>
              <TouchableOpacity onPress={() => setLogoutModalVisible(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: theme.inputBg, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>{t.no}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setLogoutModalVisible(false); logout(); }} style={{ flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFF' }}>{t.yes.split(',')[0]}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={!isConnected}>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 60 }}>
          <View style={{ backgroundColor: '#EF4444', paddingVertical: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 15, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 }}>
            <Feather name="wifi-off" size={20} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>No Internet! Please check your internet.</Text>
          </View>
        </View>
      </Modal>

      {isTranslating && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.modalOverlay, justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <ActivityIndicator size="large" color={AppConfig.primaryColor} />
          <Text style={{ marginTop: 10, fontWeight: 'bold', color: AppConfig.primaryColor }}>Translating News...</Text>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center', backgroundColor: theme.cardBg }}>
          
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={AppConfig.primaryColor} /></View>
          ) : currentTab === 'Home' ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AppConfig.primaryColor]} />}>
              {!isSearching && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border }}>
                  {headerCategories.map((cat, index) => {
                    const isSelected = activeCategory === cat.name;
                    return (
                      <TouchableOpacity key={cat.id} onPress={() => setActiveCategory(cat.name)} style={{ paddingHorizontal: 18, paddingVertical: 6, backgroundColor: isSelected ? AppConfig.primaryColor : theme.inputBg, borderRadius: 20, marginLeft: index === 0 ? 15 : 0, marginRight: 10 }}>
                        <Text style={{ color: isSelected ? '#FFF' : theme.textMuted, fontWeight: 'bold', fontSize: 13, textTransform: 'capitalize' }}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {displayNews.length === 0 ? (
                 <View style={{ padding: 50, alignItems: 'center' }}><Feather name="search" size={40} color={theme.border} /><Text style={{ marginTop: 15, color: theme.textMuted, fontWeight: 'bold', fontSize: 16 }}>{t.noNews}</Text></View>
              ) : (
                <>
                  {displayNews[0] && !isSearching && (
                    <TouchableOpacity style={{ padding: 15, borderBottomWidth: 1, borderColor: theme.border }} onPress={() => openArticle(displayNews[0])}>
                      <View style={{ position: 'relative' }}>
                        <Image source={{ uri: displayNews[0].image }} style={{ width: '100%', aspectRatio: 16/9, borderRadius: 12, backgroundColor: theme.inputBg }} resizeMode="cover" />
                        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: AppConfig.primaryColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>{displayNews[0].category}</Text></View>
                      </View>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginTop: 12, lineHeight: 28 }}>{displayNews[0].title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 15 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Feather name="clock" size={14} color={theme.textMuted} /><Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: 'bold' }}>{displayNews[0].time}</Text></View>
                      </View>
                    </TouchableOpacity>
                  )}
                  {displayNews.slice(isSearching ? 0 : 1).map((item) => (
                    <TouchableOpacity key={item.id} style={{ flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: theme.border }} onPress={() => openArticle(item)}>
                      <Image source={{ uri: item.image }} style={{ width: 100, height: 100, borderRadius: 10, backgroundColor: theme.inputBg }} resizeMode="cover" />
                      <View style={{ flex: 1, marginLeft: 15, justifyContent: 'space-between' }}>
                        <View>
                          <Text style={{ color: AppConfig.primaryColor, fontSize: 12, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' }}>{item.category}</Text>
                          <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text, lineHeight: 22 }} numberOfLines={3}>{item.title}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 5 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name="clock" size={12} color={theme.textMuted} /><Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: 'bold' }}>{item.time}</Text></View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          ) : currentTab === 'Category' ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: theme.cardBg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                  <Feather name="grid" size={24} color={theme.text} />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>{t.allCat}</Text>
                </View>
              </View>
              {headerCategories.slice(1).map((cat) => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: theme.border }}
                  onPress={() => { setActiveCategory(cat.name); setCurrentTab('Home'); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: AppConfig.primaryColor + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: AppConfig.primaryColor, fontWeight: '900', fontSize: 18 }}>{cat.name ? cat.name.charAt(0).toUpperCase() : '#'}</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text, textTransform: 'capitalize' }}>{cat.name}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : currentTab === 'Saved' ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: theme.cardBg }}>
              <View style={{ padding: 20, borderBottomWidth: 1, borderColor: theme.border }}><Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>{t.savedNews}</Text></View>
              {savedArticles.length === 0 ? (
                 <View style={{ padding: 50, alignItems: 'center' }}><Feather name="bookmark" size={40} color={theme.border} /><Text style={{ marginTop: 15, color: theme.textMuted, fontWeight: 'bold', fontSize: 16 }}>{t.noNews}</Text></View>
              ) : (
                savedArticles.map((item) => (
                  <TouchableOpacity key={item.id} style={{ flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: theme.border }} onPress={() => openArticle(item)}>
                    <Image source={{ uri: item.image }} style={{ width: 100, height: 100, borderRadius: 10, backgroundColor: theme.inputBg }} resizeMode="cover" />
                    <View style={{ flex: 1, marginLeft: 15, justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: AppConfig.primaryColor, fontSize: 12, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' }}>{item.category}</Text>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text, lineHeight: 22 }} numberOfLines={3}>{item.title}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : currentTab === 'Profile' ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: theme.cardBg }}>
              {!user ? (
                <View style={{ padding: 30, marginTop: 30, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: theme.text, marginBottom: 10 }}>Log in to MihirSync</Text>
                  <Text style={{ fontSize: 15, color: theme.textMuted, marginBottom: 40, textAlign: 'center' }}>Save articles, sync preferences, and get personalized news across devices.</Text>
                  <TouchableOpacity onPress={signInWithGoogle} style={{ backgroundColor: isDarkMode ? '#FFF' : '#111', paddingVertical: 18, paddingHorizontal: 30, borderRadius: 12, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                    <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }} style={{ width: 20, height: 20, marginRight: 10 }} />
                    <Text style={{ color: isDarkMode ? '#111' : '#FFF', fontSize: 16, fontWeight: 'bold' }}>Continue with Google</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: theme.bg, borderBottomWidth: 1, borderColor: theme.border }}>
                    <Image source={{ uri: user.photoURL }} style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: AppConfig.primaryColor }} />
                    <View style={{ marginLeft: 20 }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>{user.displayName || user.email.split('@')[0]}</Text>
                      <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 2 }}>{user.email}</Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                    <ProfileMenuItem icon="globe" title={t.language} value={appLanguage === 'gu' ? 'ગુજરાતી' : appLanguage === 'hi' ? 'हिन्दी' : 'English'} onPress={() => setLanguageModalVisible(true)} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />
                    
                    <ProfileMenuItem icon="bell" title={t.notifications} isSwitch={true} switchValue={isNotificationsEnabled} onSwitchToggle={toggleNotifications} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />

                    <ProfileMenuItem icon="bookmark" title={t.savedNews} onPress={() => setCurrentTab('Saved')} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />
                    
                    <ProfileMenuItem icon="moon" title={t.darkMode} isSwitch={true} switchValue={isDarkMode} onSwitchToggle={toggleDarkMode} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />

                    {/* 🔴 Social Media Accordion */}
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginTop: 20, marginBottom: 5 }}>Social Media Channels</Text>
                    
                    <ProfileMenuItem icon="instagram" title="Instagram Pages" isExpandable={true} isExpanded={expandedSocial === 'instagram'} onPress={() => setExpandedSocial(expandedSocial === 'instagram' ? null : 'instagram')} />
                    {expandedSocial === 'instagram' && (
                      <View style={{ paddingLeft: 20, backgroundColor: theme.inputBg, borderRadius: 10, marginBottom: 10 }}>
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync (World & Politics)" onPress={() => Linking.openURL('https://www.instagram.com/mihirsync?stkn=MW9jcnlpcWllcGNhZQ==')} />
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync Surat (Local News)" onPress={() => Linking.openURL('https://www.instagram.com/mihirsyncsurat?stkn=NTRydncwM282YjVk')} />
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync News (India & Gujarat)" onPress={() => Linking.openURL('https://www.instagram.com/mihirsyncnews?stkn=ajJzMDJ1Z2p6dzN4')} />
                      </View>
                    )}

                    <ProfileMenuItem icon="facebook" title="Facebook Pages" isExpandable={true} isExpanded={expandedSocial === 'facebook'} onPress={() => setExpandedSocial(expandedSocial === 'facebook' ? null : 'facebook')} />
                    {expandedSocial === 'facebook' && (
                      <View style={{ paddingLeft: 20, backgroundColor: theme.inputBg, borderRadius: 10, marginBottom: 10 }}>
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync Facebook" onPress={() => Linking.openURL('https://www.facebook.com/share/1Jteh38CTX/')} />
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync Surat Facebook" onPress={() => Linking.openURL('https://www.facebook.com/share/1MFTyU5hRa/')} />
                        <ProfileMenuItem icon="corner-down-right" title="MihirSync News Facebook" onPress={() => Linking.openURL('https://www.facebook.com/share/17HFHu44um/')} />
                      </View>
                    )}

                    <ProfileMenuItem icon="youtube" title="YouTube Channel" onPress={() => Linking.openURL('https://youtube.com/@mihirsync?si=YyW2XTQVB4hPQifh')} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />

                    <ProfileMenuItem icon="twitter" title="X (Twitter)" onPress={() => Linking.openURL('https://x.com/MihirSync')} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />

                    {/* 🔴 Support & Bugs */}
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginTop: 20, marginBottom: 5 }}>Support & Feedback</Text>
                    <ProfileMenuItem icon="help-circle" title="App Support" onPress={() => handleSupportEmail('support')} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />
                    <ProfileMenuItem icon="alert-triangle" title="Report Bugs" onPress={() => handleSupportEmail('bug')} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />

                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginTop: 20, marginBottom: 5 }}>Legal & About</Text>
                    <ProfileMenuItem icon="shield" title="Privacy Policy" onPress={() => setPrivacyModalVisible(true)} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />
                    <ProfileMenuItem icon="file-text" title="Terms & Conditions" onPress={() => setTermsModalVisible(true)} />
                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />
                    
                    <ProfileMenuItem icon="log-out" title={t.logout} textColor="#EF4444" onPress={() => setLogoutModalVisible(true)} />
                  </View>

                  <View style={{ padding: 20, alignItems: 'center', marginTop: 30, opacity: 0.5 }}>
                    <Image source={AppConfig.logo} style={{ width: 30, height: 30, resizeMode: 'contain', marginBottom: 10 }} />
                    <Text style={{ fontSize: 14, color: theme.textMuted, fontWeight: 'bold' }}>MihirSync App Version 1.0.0</Text>
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Powered by MihirSync</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {/* 🔴 ગૂગલ ની એડ અહી મૂકી છે (મેઈન એપના બધા પેજ પર નીચે દેખાશે) */}
      <View style={{ alignItems: 'center', marginVertical: 5 }}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : 'ca-app-pub-9566636476372749/1655224331'}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', height: 60, backgroundColor: theme.bottomNav, borderTopWidth: 1, borderColor: theme.border, justifyContent: 'space-around', alignItems: 'center' }}>
        {[
          { id: 'Home', name: t.home, icon: 'home' },
          { id: 'Category', name: t.cat, icon: 'grid' },
          { id: 'Saved', name: t.saved, icon: 'bookmark' }
        ].map((tab) => (
          <TouchableOpacity key={tab.id} onPress={() => setCurrentTab(tab.id)} style={{ alignItems: 'center', paddingHorizontal: 10 }}>
            <Feather name={tab.icon} size={22} color={currentTab === tab.id ? AppConfig.primaryColor : theme.textMuted} />
            <Text style={{ fontSize: 10, color: currentTab === tab.id ? AppConfig.primaryColor : theme.textMuted, fontWeight: 'bold', marginTop: 4 }}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function RootApp() {
  return (
    <OnboardingProvider>
      <AuthProvider>
        <AppOrchestrator />
      </AuthProvider>
    </OnboardingProvider>
  );
}

const AppOrchestrator = () => {
  const { hasCompletedOnboarding, isLoadingContext } = useContext(OnboardingContext);
  const { authLoading } = useContext(AuthContext);

  if (isLoadingContext || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color={AppConfig.primaryColor} />
      </View>
    );
  }

  return hasCompletedOnboarding ? <MainApp /> : <OnboardingFlow />;
};