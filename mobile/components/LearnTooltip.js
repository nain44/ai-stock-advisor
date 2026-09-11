import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { LEARN_CONTENT } from './learnContent';

// Small "?" icon that, when tapped, pops up a plain-language explanation of
// a financial term. Drop next to any metric label — e.g.
// <Text>RSI (14)</Text><LearnTooltip term="RSI" isDarkMode={isDarkMode} />
export default function LearnTooltip({ term, isDarkMode, size = 14 }) {
  const [visible, setVisible] = useState(false);
  const entry = LEARN_CONTENT[term];
  if (!entry) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.iconBtn}
      >
        <HelpCircle size={size} color={isDarkMode ? '#64748B' : '#94A3B8'} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.card, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF', borderColor: isDarkMode ? '#374151' : '#E2E8F0' }]}
            onPress={() => {}}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: isDarkMode ? '#00D2FF' : '#0284C7' }]}>{entry.title}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.cardBody, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>{entry.body}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    marginLeft: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
