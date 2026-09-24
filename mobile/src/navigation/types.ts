import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ReportReason, ReportTargetKind } from '../domain/types';

export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Community: undefined;
  My: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  MeetupDetail: { id: string };
  CreateMeetup: undefined;
  Chat: { meetupId: string };
  PostDetail: { id: string };
  Compose: undefined;
  Report: { kind: ReportTargetKind; id: string; reason?: ReportReason };
  Settings: undefined;
  Guidelines: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
