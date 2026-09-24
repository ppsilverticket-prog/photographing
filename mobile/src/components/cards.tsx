import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { formatExifLine } from '../domain/exif';
import { formatShortDateTime, formatWon, relativeTime } from '../domain/format';
import { activityLabel, boardLabel, difficultyLabel, kindLabel, topicLabel } from '../domain/labels';
import { seatsLeft } from '../domain/meetupRules';
import type { Meetup, Member, Post } from '../domain/types';
import { radius, space, usePalette } from '../theme';
import { Avatar, Row, Tag, Txt } from './ui';

export function feeText(m: Meetup): string {
  return m.fee.type === 'free' ? '무료' : `실비 ${formatWon(m.fee.amount)}`;
}

export function MeetupCard({
  meetup,
  host,
  status,
  onPress,
}: {
  meetup: Meetup;
  host: Member | undefined;
  status?: 'joined' | 'pending';
  onPress: () => void;
}) {
  const c = usePalette();
  const left = seatsLeft(meetup);
  const full = left === 0;
  const fillRatio = Math.min(1, meetup.participantIds.length / meetup.capacity);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meetup.title}, ${formatShortDateTime(new Date(meetup.startsAt))}, ${meetup.place.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor: c.line, backgroundColor: c.bg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        <Tag label={kindLabel[meetup.kind]} tone="neutral" />
        <Tag label={difficultyLabel[meetup.difficulty]} tone={meetup.difficulty === 'welcome' ? 'accent' : 'warn'} />
        <Tag label={feeText(meetup)} tone="neutral" />
        {status === 'joined' ? <Tag label="참여 확정" /> : null}
        {status === 'pending' ? <Tag label="승인 대기" tone="warn" /> : null}
      </Row>

      <Txt variant="subheading">{meetup.title}</Txt>

      <View style={{ gap: 2 }}>
        <Row style={{ gap: 6 }}>
          <Ionicons name="time-outline" size={14} color={c.muted} />
          <Txt variant="small" tone="muted">
            {formatShortDateTime(new Date(meetup.startsAt))}
          </Txt>
        </Row>
        <Row style={{ gap: 6 }}>
          <Ionicons name="location-outline" size={14} color={c.muted} />
          <Txt variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {meetup.place.name} · {meetup.place.district}
          </Txt>
        </Row>
      </View>

      <View style={[styles.footer, { borderTopColor: c.line }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.bar, { backgroundColor: c.surface }]}>
            <View
              style={{
                width: `${fillRatio * 100}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: full ? c.faint : c.accent,
              }}
            />
          </View>
          <Txt variant="caption" tone="muted">
            {host ? `${host.name} · 신뢰도 ${host.stats.manner?.toFixed(1) ?? '-'} · 노쇼 ${host.stats.noShows}회` : ''}
          </Txt>
        </View>
        <Txt variant="smallStrong" tone={full ? 'faint' : 'ink'} style={{ fontVariant: ['tabular-nums'] }}>
          {full ? '마감' : `${meetup.participantIds.length}/${meetup.capacity}명`}
        </Txt>
      </View>
    </Pressable>
  );
}

export function PostCard({
  post,
  author,
  now,
  onPress,
}: {
  post: Post;
  author: Member | undefined;
  now: Date;
  onPress: () => void;
}) {
  const c = usePalette();
  const exifLine = post.exif ? formatExifLine(post.exif) : post.gearNote;
  const unanswered = post.board === 'feedback' && post.answers.length === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${boardLabel[post.board]}: ${post.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.post, { borderColor: c.line, backgroundColor: c.bg, opacity: pressed ? 0.85 : 1 }]}
    >
      {post.board === 'feedback' ? (
        post.photoUri ? (
          <Image source={{ uri: post.photoUri }} style={styles.thumb} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.thumb, { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={22} color={c.faint} />
          </View>
        )
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <Tag label={post.board === 'feedback' ? topicLabel[post.topic] : boardLabel[post.board]} tone="neutral" />
          {unanswered ? <Tag label="답변 대기" tone="warn" /> : null}
        </Row>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {post.title}
        </Txt>
        {exifLine ? (
          <Txt variant="mono" tone="muted" numberOfLines={1}>
            {exifLine}
          </Txt>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, flexShrink: 1 }}>
            {author ? <Avatar name={author.name} size={18} /> : null}
            <Txt variant="caption" tone="faint" numberOfLines={1} style={{ flexShrink: 1 }}>
              {author ? `${author.name} · ${activityLabel[author.type]} · ` : ''}
              {relativeTime(new Date(post.createdAt), now)}
            </Txt>
          </Row>
          <Row style={{ gap: 10 }}>
            <Row style={{ gap: 3 }}>
              <Ionicons name="chatbubble-outline" size={13} color={c.faint} />
              <Txt variant="caption" tone="faint">
                {post.answers.length}
              </Txt>
            </Row>
            <Row style={{ gap: 3 }}>
              <Ionicons name="heart-outline" size={13} color={c.faint} />
              <Txt variant="caption" tone="faint">
                {post.likes}
              </Txt>
            </Row>
          </Row>
        </Row>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    paddingTop: space.md,
    marginTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  post: {
    flexDirection: 'row',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
  },
});
