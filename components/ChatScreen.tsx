import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { chatService, type ChatMessage, type AgentType } from '@/lib/chat-service';
import { startRecording, stopRecording, transcribeAudio } from '@/lib/voice-service';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Radius, FontSize, FontWeight, HEADER_PADDING_TOP } from '@/constants/theme';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// ── Agent configs ────────────────────────────────────────────────────────────

export interface AgentConfig {
  agent: AgentType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  pillLabel: string;
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    agent: 'chat',
    title: 'SK Chat',
    subtitle: 'Beszélgessünk!',
    icon: 'chatbubble-ellipses',
    accentColor: '#3B82F6',
    welcomeMessage:
      'Szia! Én vagyok az SK Chat, a személyes társad. Beszélgessünk bármiről – legyen szó a napodról, érzéseidről, vagy csak lazításról. Miben segíthetek?',
    inputPlaceholder: 'Írj üzenetet...',
    pillLabel: 'Chat',
  },
  {
    agent: 'assistant',
    title: 'SK Asszisztens',
    subtitle: 'Produktivitás és feladatok',
    icon: 'rocket',
    accentColor: '#F59E0B',
    welcomeMessage:
      'Szia! Én vagyok az SK Asszisztens. Segítek tervezni, priorizálni és elvégezni a feladataidat. Email, naptár, táblázatok – mondd, mire van szükséged!',
    inputPlaceholder: 'Miben segíthetek?',
    pillLabel: 'Asszisztens',
  },
  {
    agent: 'thought_interpreter',
    title: 'SK Gondolat',
    subtitle: 'Gondolatértelmezés',
    icon: 'bulb',
    accentColor: '#8B5CF6',
    welcomeMessage:
      'Szia! Én vagyok az SK Gondolat. Ha nehéz gondolatok járnak a fejedben, segítek másképp látni a dolgokat. Meséld el, min jár az eszed.',
    inputPlaceholder: 'Oszd meg a gondolataidat...',
    pillLabel: 'Gondolat',
  },
];

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ accentColor }: { accentColor: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.messageRow}>
      <View style={[styles.botAvatar, { borderColor: accentColor }]}>
        <Feather name="cpu" size={16} color={accentColor} />
      </View>
      <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <Text style={styles.typingLabel}>Gondolkodom</Text>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.Text key={i} style={[styles.typingDot, dotStyle(dot)]}>.</Animated.Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Agent selector pills ─────────────────────────────────────────────────────

function AgentSelector({
  configs,
  activeAgent,
  onSelect,
}: {
  configs: AgentConfig[];
  activeAgent: AgentType;
  onSelect: (agent: AgentType) => void;
}) {
  return (
    <View style={styles.pillContainer}>
      {configs.map((cfg) => {
        const active = cfg.agent === activeAgent;
        return (
          <TouchableOpacity
            key={cfg.agent}
            style={[
              styles.pill,
              active
                ? { backgroundColor: cfg.accentColor }
                : { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
            ]}
            onPress={() => onSelect(cfg.agent)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cfg.icon}
              size={14}
              color={active ? Colors.textWhite : Colors.textMuted}
            />
            <Text
              style={[
                styles.pillText,
                { color: active ? Colors.textWhite : Colors.textMuted },
              ]}
            >
              {cfg.pillLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main ChatScreen ──────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'recording' | 'transcribing';

export default function ChatScreen() {
  const { user } = useAuth();

  // Agent state
  const [activeAgent, setActiveAgent] = useState<AgentType>('chat');
  const activeConfig = AGENT_CONFIGS.find((c) => c.agent === activeAgent)!;

  // Messages per agent (cached so switching is instant)
  const [messagesMap, setMessagesMap] = useState<Record<AgentType, ChatMessage[]>>({
    chat: [],
    assistant: [],
    thought_interpreter: [],
  });
  const [loadedAgents, setLoadedAgents] = useState<Set<AgentType>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Voice
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const messages = messagesMap[activeAgent];

  // ── Load messages for an agent ───────────────────────────────────────────

  const loadMessages = useCallback(async (agent: AgentType) => {
    try {
      const data = await chatService.getMessages(agent, 50);
      setMessagesMap((prev) => ({ ...prev, [agent]: data }));
      setLoadedAgents((prev) => new Set(prev).add(agent));
    } catch (error) {
      console.error('[ChatScreen] Error loading messages:', error);
    }
  }, []);

  // Load initial agent on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadMessages('chat');
      setLoading(false);
    })();
  }, [user, loadMessages]);

  // Load when switching to an agent that hasn't been loaded yet
  useEffect(() => {
    if (!user || loading) return;
    if (!loadedAgents.has(activeAgent)) {
      loadMessages(activeAgent);
    }
  }, [activeAgent, user, loading, loadedAgents, loadMessages]);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // ── Pulse animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (voiceState === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseAnimRef.current = anim;
      anim.start();
    } else {
      pulseAnimRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [voiceState]);

  // ── Agent switch ───────────────────────────────────────────────────────

  const handleAgentSwitch = (agent: AgentType) => {
    if (agent === activeAgent || sending) return;
    setActiveAgent(agent);
  };

  // ── Voice ──────────────────────────────────────────────────────────────

  const handleMicPress = async () => {
    if (voiceState === 'transcribing') return;

    if (voiceState === 'recording') {
      if (!recordingRef.current) return;
      try {
        const uri = await stopRecording(recordingRef.current);
        recordingRef.current = null;
        setVoiceState('transcribing');
        const text = await transcribeAudio(uri);
        if (text) {
          setInputText((prev) => (prev ? `${prev} ${text}` : text));
        } else {
          Alert.alert('Hiba', 'Nem sikerült felismerni a beszédet. Próbáld újra.');
        }
      } catch (error: any) {
        if (error?.message === 'NO_AUDIO') {
          Alert.alert('Hiba', 'Nem érzékeltem hangot');
        } else {
          Alert.alert('Hiba', 'Nem sikerült felismerni a beszédet. Próbáld újra.');
        }
      } finally {
        setVoiceState('idle');
      }
      return;
    }

    try {
      const recording = await startRecording();
      recordingRef.current = recording;
      setVoiceState('recording');
    } catch (error: any) {
      if (error?.message === 'PERMISSION_DENIED') {
        Alert.alert('Mikrofon engedély', 'A mikrofon használatához engedélyt kell adnod a Beállításokban');
      } else {
        console.error('[ChatScreen] Recording error:', error);
        Alert.alert('Hiba', 'Nem sikerült elindítani a felvételt.');
      }
    }
  };

  // ── Send ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const agent = activeAgent;
    setInputText('');
    setSending(true);

    try {
      const userMsg = await chatService.saveMessage('user', text, agent);
      setMessagesMap((prev) => ({ ...prev, [agent]: [...prev[agent], userMsg] }));
      scrollToBottom();

      const reply = await chatService.sendToWebhook(text, agent);

      const assistantMsg = await chatService.saveMessage('assistant', reply, agent);
      setMessagesMap((prev) => ({ ...prev, [agent]: [...prev[agent], assistantMsg] }));
      scrollToBottom();
    } catch (error) {
      console.error('[ChatScreen] Error sending message:', error);
      try {
        const errorMsg = await chatService.saveMessage(
          'assistant',
          'Hiba történt a kapcsolódásban. Ellenőrizd az internetkapcsolatod.',
          agent
        );
        setMessagesMap((prev) => ({ ...prev, [agent]: [...prev[agent], errorMsg] }));
        scrollToBottom();
      } catch {
        Alert.alert('Hiba', 'Nem sikerült elküldeni az üzenetet.');
      }
    } finally {
      setSending(false);
    }
  };

  // ── Clear ──────────────────────────────────────────────────────────────

  const handleClear = () => {
    const agent = activeAgent;
    Alert.alert('Beszélgetés törlése', 'Biztosan törölni szeretnéd az összes üzenetet?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Törlés',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatService.clearConversation(agent);
            setMessagesMap((prev) => ({ ...prev, [agent]: [] }));
          } catch {
            Alert.alert('Hiba', 'Nem sikerült törölni a beszélgetést.');
          }
        },
      },
    ]);
  };

  // ── Renderers ──────────────────────────────────────────────────────────

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={[styles.botAvatar, { borderColor: activeConfig.accentColor }]}>
            <Feather name="cpu" size={16} color={activeConfig.accentColor} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: activeConfig.accentColor }]
              : styles.assistantBubble,
          ]}
        >
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{item.content}</Text>
          <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.welcomeIcon, { borderColor: activeConfig.accentColor }]}>
        <Ionicons name={activeConfig.icon} size={48} color={activeConfig.accentColor} />
      </View>
      <Text style={styles.welcomeTitle}>{activeConfig.title}</Text>
      <Text style={styles.welcomeSubtitle}>{activeConfig.subtitle}</Text>
      <Text style={styles.welcomeText}>{activeConfig.welcomeMessage}</Text>
    </View>
  );

  const renderVoiceStatus = () => {
    if (voiceState === 'recording') {
      return (
        <View style={styles.voiceStatus}>
          <View style={styles.voiceStatusDot} />
          <Text style={styles.voiceStatusText}>Felvétel...</Text>
        </View>
      );
    }
    if (voiceState === 'transcribing') {
      return (
        <View style={styles.voiceStatus}>
          <ActivityIndicator size="small" color={activeConfig.accentColor} />
          <Text style={styles.voiceStatusText}>Feldolgozás...</Text>
        </View>
      );
    }
    return null;
  };

  const renderMicButton = () => {
    if (voiceState === 'transcribing') {
      return (
        <View style={styles.micButton}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
        </View>
      );
    }
    if (voiceState === 'recording') {
      return (
        <TouchableOpacity onPress={handleMicPress} activeOpacity={0.7}>
          <Animated.View
            style={[styles.micButton, styles.micButtonRecording, { transform: [{ scale: pulseAnim }] }]}
          >
            <Ionicons name="mic" size={22} color="#EF4444" />
          </Animated.View>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.micButton} onPress={handleMicPress} activeOpacity={0.7} disabled={sending}>
        <Ionicons name="mic-outline" size={22} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="chatbubble-ellipses" size={24} color={Colors.primary} />
            <Text style={styles.headerTitle}>SK Chat</Text>
          </View>
        </View>
        <LoadingScreen />
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={activeConfig.icon} size={24} color={activeConfig.accentColor} />
          <View>
            <Text style={styles.headerTitle}>{activeConfig.title}</Text>
            <Text style={styles.headerSubtitle}>{activeConfig.subtitle}</Text>
          </View>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.headerButton}>
            <Feather name="trash-2" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Agent selector */}
      <AgentSelector configs={AGENT_CONFIGS} activeAgent={activeAgent} onSelect={handleAgentSwitch} />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messagesList, messages.length === 0 && styles.messagesListEmpty]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={sending ? <TypingIndicator accentColor={activeConfig.accentColor} /> : null}
          onContentSizeChange={() => {
            if (messages.length > 0 || sending) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />

        {renderVoiceStatus()}

        {/* Input bar */}
        <View style={styles.inputContainer}>
          {renderMicButton()}
          <TextInput
            style={styles.input}
            placeholder={activeConfig.inputPlaceholder}
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: activeConfig.accentColor },
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Feather name="send" size={20} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  headerButton: {
    padding: Spacing.sm,
  },

  // Agent pills
  pillContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    padding: Spacing.xs,
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Chat area
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Empty / welcome
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  welcomeTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textWhite,
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  welcomeText: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: FontSize.lg,
    color: Colors.textWhite,
    lineHeight: 22,
  },
  userMessageText: {
    color: Colors.textWhite,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Typing indicator
  typingBubble: {
    paddingVertical: Spacing.md,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingLabel: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  typingDot: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    fontStyle: 'italic',
    fontWeight: FontWeight.bold,
  },

  // Voice status
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  voiceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  voiceStatusText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Input bar
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textWhite,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});
