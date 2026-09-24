import { View } from 'react-native';

import { Screen, Section, Txt } from '../components/ui';
import { space } from '../theme';

// docs/07-operations-policy.md 3절 공개 문안 초안과 같은 내용
const sections: { title: string; items: string[] }[] = [
  {
    title: '사람을 찍을 때',
    items: [
      '모르는 사람을 알아볼 수 있게 찍었다면 먼저 물어보세요. 얼굴이 알아보이는 사진을 올리려면 찍힌 사람의 동의가 필요해요. 공개된 장소에서 찍었다는 이유만으로 올려도 되는 건 아니에요.',
      '몰래 찍기, 특정 신체 부위를 노린 촬영, 성적인 목적의 촬영은 금지예요. 확인되면 계정을 바로 영구 정지하고 수사기관에 협조해요.',
      '모임에서 서로 찍어 준 사진은 모임 앨범에 올리기 전에 찍힌 사람에게 물어보세요. 내 모습이 나온 사진을 지워 달라고 하면 지워 주세요.',
      '아이가 나온 사진은 보호자의 허락 없이 올리지 마세요.',
    ],
  },
  {
    title: '장소와 사진',
    items: [
      '촬영 금지 구역, 사유지, 출입 통제 구역의 규칙을 지켜 주세요. 모임장은 모임 장소의 촬영 규칙을 미리 확인해 주세요.',
      '다른 사람이 찍은 사진을 내 사진처럼 올리지 마세요. 참고 사진을 올릴 때는 찍은 사람을 적어 주세요.',
    ],
  },
  {
    title: '모임에서',
    items: [
      '못 가게 되면 모임 시작 24시간 전까지 취소해 주세요. 연락 없이 안 나오면 기록이 남고 모임 신청이 제한될 수 있어요.',
      '모임은 사진을 찍으러 나온 자리예요. 연락처 교환이나 따로 만나자는 요구를 강요하지 마세요. 상대가 거절하면 거기서 멈춰 주세요.',
      '술을 권하거나 모임을 다른 장소로 옮기자고 강요하지 마세요.',
      '허락받지 않은 영업, 홍보, 촬영 의뢰 모집은 하지 마세요.',
    ],
  },
  {
    title: '피드백과 대화에서',
    items: [
      '피드백은 사진에 대해서만 해 주세요. 찍은 사람의 나이, 성별, 장비, 실력을 깎아내리지 마세요.',
      '욕설, 혐오 표현, 괴롭힘, 다른 사람을 사칭하는 행동은 금지예요.',
    ],
  },
  {
    title: '이런 일이 생기면',
    items: [
      '모임 중 위험을 느끼면 먼저 112에 연락하세요. 그다음 모임 채팅의 긴급 신고로 운영팀에 알려 주세요.',
      '불편했던 사람은 차단하면 서로의 모임과 글이 보이지 않아요.',
      '가이드라인을 어기면 경고, 이용 제한, 영구 정지 순서로 조치해요. 불법 촬영, 성희롱, 폭력, 위협은 경고 없이 영구 정지해요.',
    ],
  },
];

// 번호는 "이런 일이 생기면"을 빼고 처음부터 이어서 붙인다
let counter = 0;
const numbered = sections.map((s) => ({
  ...s,
  items: s.items.map((text) => ({ text, label: s.title === '이런 일이 생기면' ? '·' : `${++counter}.` })),
}));

export default function GuidelinesScreen() {
  return (
    <Screen>
      <Txt tone="muted">
        포토그래핑은 사진 찍는 사람들이 처음 만나 함께 걷고 찍는 곳이에요. 모두가 안심하고 다시 나올 수 있도록 아래
        약속을 지켜 주세요.
      </Txt>
      {numbered.map((s) => (
        <Section key={s.title} title={s.title}>
          <View style={{ gap: space.md }}>
            {s.items.map((item) => (
              <View key={item.text} style={{ flexDirection: 'row', gap: space.sm }}>
                <Txt variant="smallStrong" tone="accent" style={{ width: 22, marginTop: 1 }}>
                  {item.label}
                </Txt>
                <Txt style={{ flex: 1 }}>{item.text}</Txt>
              </View>
            ))}
          </View>
        </Section>
      ))}
    </Screen>
  );
}
