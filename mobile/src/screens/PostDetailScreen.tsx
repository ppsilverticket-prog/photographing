import Ionicons from '@expo/vector-icons/Ionicons';
import { useLayoutEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  Input,
  PhotoPlaceholder,
  Row,
  Screen,
  Section,
  Tag,
  Txt,
} from '../components/ui';
import { useMyId, useStore } from '../data/store';
import { formatExifLine, isEmptyExif } from '../domain/exif';
import { relativeTime } from '../domain/format';
import { activityLabel, boardLabel, topicLabel } from '../domain/labels';
import type { RootScreenProps } from '../navigation/types';
import { radius, space, usePalette } from '../theme';

export default function PostDetailScreen({ route, navigation }: RootScreenProps<'PostDetail'>) {
  const { state, actions } = useStore();
  const myId = useMyId();
  const c = usePalette();
  const [menuOpen, setMenuOpen] = useState(false);
  const [answer, setAnswer] = useState('');

  const post = state.posts.find((p) => p.id === route.params.id);
  const mine = post?.authorId === myId;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: post ? boardLabel[post.board] : '',
      headerRight: mine ? undefined : () => <IconButton icon="ellipsis-horizontal" label="더 보기" onPress={() => setMenuOpen((v) => !v)} />,
    });
  }, [navigation, post, mine]);

  if (!post || state.blocked.includes(post.authorId)) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="글을 볼 수 없어요" body="삭제됐거나 차단한 사람의 글이에요." />
      </Screen>
    );
  }

  const author = state.members[post.authorId];
  const now = new Date();
  const liked = state.liked.includes(post.id);
  const exifLine = post.exif && !isEmptyExif(post.exif) ? formatExifLine(post.exif) : post.gearNote;
  const answers = post.answers.filter((a) => !state.blocked.includes(a.authorId));

  const submit = () => {
    const body = answer.trim();
    if (body.length < 5) return;
    actions.answer(post.id, body);
    setAnswer('');
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Input
            value={answer}
            onChangeText={setAnswer}
            placeholder={
              post.board === 'feedback'
                ? '어느 부분을, 왜, 어떻게 바꾸면 좋을지 적어 주세요'
                : '댓글을 남겨 주세요'
            }
            multiline
            style={{ minHeight: 64 }}
          />
          <Button label={post.board === 'feedback' ? '피드백 남기기' : '댓글 남기기'} onPress={submit} disabled={answer.trim().length < 5} />
        </View>
      }
    >
      {menuOpen && author ? (
        <Card style={{ gap: 0, paddingVertical: space.xs }}>
          <Button
            label="이 글 신고하기"
            variant="ghost"
            icon="flag-outline"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('Report', { kind: 'post', id: post.id });
            }}
          />
          <Button
            label={`${author.name} 님 차단하기`}
            variant="ghost"
            icon="ban-outline"
            onPress={() => {
              actions.block(author.id);
              navigation.goBack();
            }}
          />
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        <Row style={{ gap: 6 }}>
          <Tag label={post.board === 'feedback' ? topicLabel[post.topic] : boardLabel[post.board]} tone="neutral" />
        </Row>
        <Txt variant="title">{post.title}</Txt>
        {author ? (
          <Row>
            <Avatar name={author.name} size={28} />
            <Txt variant="small" tone="muted">
              {author.name} · {activityLabel[author.type]} · {relativeTime(new Date(post.createdAt), now)}
            </Txt>
          </Row>
        ) : null}
      </View>

      {post.board === 'feedback' ? (
        <View style={{ gap: space.sm }}>
          {post.photoUri ? (
            <Image
              source={{ uri: post.photoUri }}
              style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: radius.md, backgroundColor: c.surface }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <PhotoPlaceholder height={220} label="예시 글이라 사진이 없어요" />
          )}
          {exifLine ? (
            <Txt variant="mono" tone="muted">
              {exifLine}
            </Txt>
          ) : null}
        </View>
      ) : null}

      <Txt>{post.body}</Txt>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: liked }}
        onPress={() => actions.toggleLike(post.id)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
      >
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? c.danger : c.muted} />
        <Txt variant="small" tone="muted">
          {post.likes}
        </Txt>
      </Pressable>

      <Divider />

      <Section title={`${post.board === 'feedback' ? '피드백' : '댓글'} ${answers.length}`}>
        {answers.length === 0 ? (
          <Txt tone="muted">
            {post.board === 'feedback' ? '아직 피드백이 없어요. 첫 피드백을 남겨 주세요.' : '아직 댓글이 없어요.'}
          </Txt>
        ) : (
          answers.map((a) => {
            const who = state.members[a.authorId];
            return (
              <Card key={a.id} style={{ gap: space.sm }}>
                <Row>
                  {who ? <Avatar name={who.name} size={24} /> : null}
                  <Txt variant="smallStrong">{who?.name ?? '알 수 없음'}</Txt>
                  <Txt variant="caption" tone="faint">
                    {who ? activityLabel[who.type] : ''} · {relativeTime(new Date(a.createdAt), now)}
                  </Txt>
                </Row>
                <Txt>{a.body}</Txt>
              </Card>
            );
          })
        )}
      </Section>
    </Screen>
  );
}
