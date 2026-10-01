import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppConfig } from '../utils/config';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function CategoryScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔴 એડમિન પેનલમાંથી લાઈવ કેટેગરી લાવવા માટે
  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const catList = [];
      snapshot.forEach((doc) => {
        catList.push({ id: doc.id, ...doc.data() });
      });
      setCategories(catList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      
      {/* 1. Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <Feather name="grid" size={24} color="#111" />
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#111' }}>બધા વિભાગો</Text>
        </View>
        <Feather name="search" size={22} color="#111" />
      </View>

      {/* 2. Live Category List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={AppConfig.primaryColor} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#F3F4F6' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                
                {/* આઇકોન માટે ગોળ બેકગ્રાઉન્ડ */}
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: AppConfig.primaryColor + '15', justifyContent: 'center', alignItems: 'center' }}>
                  {/* નામનો પહેલો અક્ષર બતાવશે */}
                  <Text style={{ color: AppConfig.primaryColor, fontWeight: '900', fontSize: 18 }}>
                    {cat.name ? cat.name.charAt(0) : '#'}
                  </Text>
                </View>
                
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#374151' }}>{cat.name}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

    </View>
  );
}