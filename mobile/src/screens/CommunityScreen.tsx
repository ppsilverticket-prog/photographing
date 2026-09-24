import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PostCard } from '../components/cards';
import { Chip, EmptyState, Txt, useRefresh } from '../components/ui';
import { useMe, useStore, useVisible } from '../data/store';
import { boardLabel, topicLabel } from '../domain/labels';
import type { Board, FeedbackTopic } from '../domain/types';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { fonts, radius, space, usePalette } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Community'>,
  NativeStackScreenProps<RootStackParamList>
>;

const boards: Board[] = ['feedback', 'lounge', 'qna'];

export default function CommunityScreen({ navigation }: Props) {
  const me = useMe();
  const { state, mode, actions } = useStore();
  const refresh = useRefresh(mode === 'server' ? actions.refresh : undefined);
  const { posts } = useVisible();
  const c = usePalette();
  const [board, setBoard] = useState<Board>('feedback');
  const [unanswered, setUnanswered] = useState(false);
  const [sameType, setSameType] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopic | null>(null);
  const now = new Date();

  const list = posts
    .filter((p) => p.board === board)
    .filter((p) => !unanswered || p.answers.length === 0)
    .filter((p) => !sameType || state.members[p.authorId]?.type === me.type)
    .filter((p) => !topic || p.topic === topic)
    // 피드백 게시판은 답변이 없는 글을 먼저 (플랜 11절: 답변율 70%)
    .sort((a, b) =>
      board === 'feedback'
        ? Number(a.answers.length > 0) - Number(b.answers.length > 0) || b.createdAt.localeCompare(a.createdAt)
        : b.likes - a.likes,
    );

  const waiting = posts.filter((p) => p.board === 'feedback' && p.answers.length === 0).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.segment, { borderBottomColor: c.line }]}>
        {boards.map((b) => {
          const on = board === b;
          return (
            <Pressable
              key={b}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setBoard(b)}
              style={[styles.segmentItem, { borderBottomColor: on ? c.accent : 'transparent' }]}
            >
              <Txt variant="smallStrong" tone={on ? 'ink' : 'faint'}>
                {boardLabel[b]}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} refreshControl={refresh}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingVertical: space.md, gap: space.sm }}
        >
          {board === 'feedback' ? (
            <Chip label="답변 대기" selected={unanswered} onPress={() => setUnanswered((v) => !v)} />
          ) : null}
          <Chip label="내 유형" selected={sameType} onPress={() => setSameType((v) => !v)} />
          {board === 'feedback'
            ? (['exposure', 'retouch', 'film'] as FeedbackTopic[]).map((t) => (
                <Chip key={t} label={topicLabel[t]} selected={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
              ))
            : null}
        </ScrollView>

        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          {board === 'feedback' ? (
            <View style={[styles.summary, { backgroundColor: c.accentSoft }]}>
              <Txt variant="bodyStrong" tone="accent">
                답변을 기다리는 사진 {waiting}장
              </Txt>
              <Txt variant="caption" tone="accent">
                구체적인 한 마디가 사진을 바꿔요. 사진에 대해서만 이야기해 주세요.
              </Txt>
            </View>
          ) : null}

          {list.length === 0 ? (
            <EmptyState icon="images-outline" title="아직 글이 없어요" />
          ) : (
            list.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                author={state.members[p.authorId]}
                now={now}
                onPress={() => navigation.navigate('PostDetail', { id: p.id })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Compose')}
        style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="camera-outline" size={20} color={c.onAccent} />
        <Txt style={{ color: c.onAccent, fontFamily: fonts.semibold }}>사진 올리기</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmentItem: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 2,
  },
  summary: {
    padding: space.lg,
    borderRadius: radius.md,
    gap: 2,
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
