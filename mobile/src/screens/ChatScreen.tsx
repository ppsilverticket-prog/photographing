import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState, Row, Txt } from '../components/ui';
import { useMyId, useStore } from '../data/store';
import { formatTime } from '../domain/format';
import type { RootScreenProps } from '../navigation/types';
import { fonts, radius, space, usePalette } from '../theme';

export default function ChatScreen({ route, navigation }: RootScreenProps<'Chat'>) {
  const { state, actions } = useStore();
  const myId = useMyId();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [emergency, setEmergency] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const meetup = state.meetups.find((m) => m.id === route.params.meetupId);

  useLayoutEffect(() => {
    if (meetup) navigation.setOptions({ title: meetup.title });
  }, [navigation, meetup]);

  // 새 메시지를 실시간으로 받는다 (서버 모드)
  const { meetupId } = route.params;
  useEffect(() => actions.subscribeChat(meetupId), [actions, meetupId]);

  // 참여가 확정된 사람만 모임 채팅에 들어올 수 있다
  if (!meetup || !meetup.participantIds.includes(myId)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <EmptyState icon="lock-closed-outline" title="참여가 확정된 사람만 볼 수 있어요" />
      </View>
    );
  }

  const messages = state.chats.filter((m) => m.meetupId === meetup.id && !state.blocked.includes(m.authorId));

  const send = () => {
    const body = text.trim();
    if (!body) return;
    actions.chat(meetup.id, body);
    setText('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={[styles.emergencyBar, { borderBottomColor: c.line }]}>
        {emergency ? (
          <View style={{ gap: space.md }}>
            <Txt variant="bodyStrong" tone="danger">
              위험하다고 느끼면 먼저 경찰에 연락하세요
            </Txt>
            <Txt variant="title" tone="danger" selectable style={{ fontSize: 34, lineHeight: 40 }}>
              112
            </Txt>
            <Txt variant="small" tone="muted">
              그다음 운영팀에 알려 주세요. 신고한 상대의 계정은 먼저 정지하고 확인해요.
            </Txt>
            <Row>
              <Button
                label="운영팀에 긴급 신고"
                variant="danger"
                icon="alert-circle"
                onPress={() => navigation.navigate('Report', { kind: 'meetup', id: meetup.id, reason: 'emergency' })}
                style={{ flex: 1 }}
              />
              <Button label="닫기" variant="secondary" onPress={() => setEmergency(false)} />
            </Row>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setEmergency(true)}
            style={({ pressed }) => [styles.emergencyBtn, { backgroundColor: c.dangerSoft, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="alert-circle" size={18} color={c.danger} />
            <Txt variant="smallStrong" tone="danger">
              긴급 신고
            </Txt>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: space.xl, gap: space.md }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((m) => {
          const mine = m.authorId === myId;
          const author = state.members[m.authorId];
          return (
            <View key={m.id} style={[styles.msgRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
              {!mine && author ? <Avatar name={author.name} size={30} /> : null}
              <View style={{ maxWidth: '78%', gap: 2, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && author ? (
                  <Txt variant="caption" tone="muted">
                    {author.name}
                    {author.id === meetup.hostId ? ' · 모임장' : ''}
                  </Txt>
                ) : null}
                <View style={[styles.bubble, { backgroundColor: mine ? c.accent : c.surface }]}>
                  <Txt style={{ color: mine ? c.onAccent : c.ink }}>{m.body}</Txt>
                </View>
                <Txt variant="caption" tone="faint">
                  {formatTime(new Date(m.createdAt))}
                </Txt>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.inputBar, { borderTopColor: c.line, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="메시지 보내기"
          placeholderTextColor={c.faint}
          style={[styles.input, { color: c.ink, backgroundColor: c.surface, fontFamily: fonts.regular }]}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보내기"
          onPress={send}
          disabled={!text.trim()}
          style={[styles.send, { backgroundColor: text.trim() ? c.accent : c.line }]}
        >
          <Ionicons name="arrow-up" size={20} color={c.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  emergencyBar: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  msgRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  inputBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  // 웹에서 입력창은 기본 너비가 있어서 minWidth: 0이 없으면 보내기 버튼을 밀어낸다
  input: { flex: 1, minWidth: 0, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
