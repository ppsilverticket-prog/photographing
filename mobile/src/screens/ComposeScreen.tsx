import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { Banner, Button, Checkbox, Chip, Field, Input, Screen, Toggle, Txt, Wrap } from '../components/ui';
import { useStore } from '../data/store';
import { formatExifLine, hasGpsData, isEmptyExif, summarizeExif, uploadResize } from '../domain/exif';
import { boardLabel, topicLabel } from '../domain/labels';
import type { Board, ExifSummary, FeedbackTopic } from '../domain/types';
import type { RootScreenProps } from '../navigation/types';
import { radius, space, usePalette } from '../theme';

interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
  exif: ExifSummary;
  hadGps: boolean;
}

/**
 * 사진을 다시 저장해 EXIF를 통째로 떼어 내고(위치·기기 일련번호 포함), 긴 변을 2048px로 줄인다.
 * 보여 줄 촬영 정보는 떼기 전에 따로 요약해 둔다. 서버에서도 한 번 더 지운다 (운영정책 D2).
 */
async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const exif = summarizeExif(asset.exif);
  const hadGps = hasGpsData(asset.exif);
  const context = ImageManipulator.manipulate(asset.uri);
  const resize = uploadResize(asset.width, asset.height);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height, exif, hadGps };
}

export default function ComposeScreen({ navigation }: RootScreenProps<'Compose'>) {
  const { actions } = useStore();
  const c = usePalette();

  const [board, setBoard] = useState<Board>('feedback');
  const [topic, setTopic] = useState<FeedbackTopic>('exposure');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [working, setWorking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [gearNote, setGearNote] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hasPerson, setHasPerson] = useState(false);
  const [consent, setConsent] = useState(false);

  const pick = async () => {
    setPickError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', exif: true, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setWorking(true);
    try {
      setPhoto(await preparePhoto(result.assets[0]));
    } catch {
      setPickError('사진을 준비하지 못했어요. 다른 사진을 골라 주세요.');
    } finally {
      setWorking(false);
    }
  };

  const needsPhoto = board === 'feedback';
  const ready =
    title.trim().length >= 4 && body.trim().length >= 10 && (!needsPhoto || photo) && (!hasPerson || consent) && !working;

  const submit = () => {
    if (!ready) return;
    const id = actions.addPost({
      board,
      topic: board === 'feedback' ? topic : 'general',
      title: title.trim(),
      body: body.trim(),
      exif: photo && !isEmptyExif(photo.exif) ? photo.exif : undefined,
      gearNote: gearNote.trim() || undefined,
      photoUri: photo?.uri,
    });
    navigation.replace('PostDetail', { id });
  };

  return (
    <Screen
      footer={
        <Button
          label={board === 'feedback' ? '피드백 요청 올리기' : '글 올리기'}
          onPress={submit}
          disabled={!ready}
          accessibilityHint="제목 4자, 내용 10자 이상이 필요해요"
        />
      }
    >
      <Wrap>
        {(['feedback', 'lounge', 'qna'] as Board[]).map((b) => (
          <Chip key={b} label={boardLabel[b]} selected={board === b} onPress={() => setBoard(b)} />
        ))}
      </Wrap>

      <View style={{ gap: space.md }}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{
              width: '100%',
              aspectRatio: photo.width / photo.height,
              maxHeight: 360,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Button
          label={photo ? '다른 사진 고르기' : needsPhoto ? '사진 고르기' : '사진 추가 (선택)'}
          icon="images-outline"
          variant="secondary"
          onPress={pick}
          loading={working}
        />
        {pickError ? (
          <Txt variant="caption" tone="danger">
            {pickError}
          </Txt>
        ) : null}

        {photo ? (
          <>
            <Banner tone="info" icon="location-outline">
              {photo.hadGps
                ? '사진에 있던 위치 정보(GPS)를 지웠어요. 촬영 정보만 남겼어요.'
                : '위치 정보가 없는 사진이에요. 촬영 정보만 보여 줘요.'}
            </Banner>
            {isEmptyExif(photo.exif) ? (
              <Field label="장비 정보" hint="촬영 정보가 없어요. 필름이면 직접 적어 주세요">
                <Input value={gearNote} onChangeText={setGearNote} placeholder="예: Nikon FM2 · 50mm · Portra 400" />
              </Field>
            ) : (
              <View style={{ gap: 4 }}>
                <Txt variant="smallStrong">촬영 정보</Txt>
                <Txt variant="mono" tone="muted">
                  {formatExifLine(photo.exif)}
                </Txt>
                {photo.exif.lens ? (
                  <Txt variant="mono" tone="faint">
                    {photo.exif.lens}
                  </Txt>
                ) : null}
              </View>
            )}
          </>
        ) : null}
      </View>

      {board === 'feedback' ? (
        <Field label="어떤 피드백이 필요해요?">
          <Wrap>
            {(['exposure', 'retouch', 'film', 'gear'] as FeedbackTopic[]).map((t) => (
              <Chip key={t} label={topicLabel[t]} selected={topic === t} onPress={() => setTopic(t)} />
            ))}
          </Wrap>
        </Field>
      ) : null}

      <Field label="제목">
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder={board === 'feedback' ? '예: 야경 노출과 구도 봐주세요' : '제목'}
          maxLength={50}
        />
      </Field>

      <Field label={board === 'feedback' ? '어느 부분을 봐 주면 좋을까요?' : '내용'}>
        <Input
          value={body}
          onChangeText={setBody}
          placeholder={
            board === 'feedback'
              ? '예: 삼각대 없이 찍었는데 너무 어두운가요? 하늘과 건물 경계가 답답해 보여요.'
              : '내용을 적어 주세요'
          }
          multiline
        />
      </Field>

      {photo ? (
        <View style={{ gap: space.md }}>
          <Toggle
            value={hasPerson}
            onChange={(v) => {
              setHasPerson(v);
              if (!v) setConsent(false);
            }}
            label="얼굴을 알아볼 수 있는 사람이 나와요"
          />
          {hasPerson ? (
            <Checkbox value={consent} onChange={setConsent} label="찍힌 사람에게 이 사진을 올려도 된다는 동의를 받았어요" />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
