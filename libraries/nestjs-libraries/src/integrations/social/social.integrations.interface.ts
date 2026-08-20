import { Integration } from '@prisma/client';

export interface ClientInformation {
  client_id: string;
  client_secret: string;
  instanceUrl: string;
}
export interface IAuthenticator {
  authenticate(
    params: {
      code: string;
      codeVerifier: string;
      refresh?: string;
    },
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string>;
  refreshToken(refreshToken: string): Promise<AuthTokenDetails>;
  reConnect?(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<Omit<AuthTokenDetails, 'refreshToken' | 'expiresIn'>>;
  generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse>;
  analytics?(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]>;
  postAnalytics?(
    integrationId: string,
    accessToken: string,
    postId: string,
    fromDate: number,
  ): Promise<AnalyticsData[]>;
  changeNickname?(
    id: string,
    accessToken: string,
    name: string
  ): Promise<{ name: string }>;
  changeProfilePicture?(
    id: string,
    accessToken: string,
    url: string
  ): Promise<{ url: string }>;
  missing?(
    id: string,
    accessToken: string
  ): Promise<{ id: string; url: string }[]>;
}

export interface AnalyticsData {
  label: string;
  data: Array<{ total: string; date: string }>;
  percentageChange: number;
}


export type GenerateAuthUrlResponse = {
  url: string;
  codeVerifier: string;
  state: string;
};

export type AuthTokenDetails = {
  id: string;
  name: string;
  error?: string;
  accessToken: string; // The obtained access token
  refreshToken?: string; // The refresh token, if applicable
  expiresIn?: number; // The duration in seconds for which the access token is valid
  picture?: string;
  username: string;
  additionalSettings?: {
    title: string;
    description: string;
    type: 'checkbox' | 'text' | 'textarea';
    value: any;
    regex?: string;
  }[];
};

export interface ISocialMediaIntegration {
  post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]>; // Schedules a new post

  postPending?(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]>; // Like `post`, but may return a `pending` response the workflow resolves via checkPostStatus / finalizePost

  comment?(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]>; // Schedules a new post
}

export type PostResponse = {
  id: string; // The db internal id of the post
  postId: string; // The ID of the scheduled post returned by the platform
  releaseURL: string; // The URL of the post on the platform
  status: string; // Status of the operation or initial post status, 'pending' means the workflow must poll checkPostStatus
  pendingData?: any; // Opaque provider state used by checkPostStatus / finalizePost, never inspected by generic code
};

// Returned by checkPostStatus / finalizePost:
// 'pending' - the platform is still processing, poll again later
// 'ready' - processing is done, the workflow must call finalizePost to run the remaining mutations
// 'completed' - the post is fully published
//
// Contract: once finalizePost's mutations have actually gone through on the
// platform, checkPostStatus must return 'completed' - never 'ready' again -
// otherwise a finalizePost retry after an unknown-outcome failure would re-run
// the mutations and duplicate the post. The only exception: when finalizePost's
// mutation is idempotent (like setting a thumbnail), returning 'ready' again is
// allowed, since re-running it cannot duplicate anything.
export type PendingCheckResponse =
  | { status: 'pending'; pendingData: any }
  | { status: 'ready'; pendingData: any }
  | { status: 'completed'; postId: string; releaseURL: string };

export type PostDetails<T = any> = {
  id: string;
  message: string;
  settings: T;
  media?: MediaContent[];
  poll?: PollDetails;
};

export type PollDetails = {
  options: string[]; // Array of poll options
  duration: number; // Duration in hours for which the poll will be active
};

export type MediaContent = {
  type: 'image' | 'video'; // Type of the media content
  path: string;
  alt?: string;
  thumbnail?: string;
  thumbnailTimestamp?: number;
};

export type FetchPageInformationResult = {
  id: string;
  name: string;
  access_token: string;
  picture: string;
  username: string;
};

export type VideoListItem = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
};

export type VideoDetails = VideoListItem & {
  tags: string[];
  privacyStatus: string;
};

export type VideoComment = {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  text: string;
  publishedAt: string;
  likeCount: number;
  totalReplyCount: number;
  hasChannelOwnerReply: boolean;
};

// Optimizer Phase 5: a plain-text transcript with inline "[mm:ss]" markers
// per line, sourced from the video's caption track. `source` is always
// 'captions' today (v1 scope per YOUTUBE_OPTIMIZER_PLAN.md 3d) - kept as a
// discriminated field rather than a bare string so a future frame-sampling
// v2 can add a 'captions+frames' source without changing callers.
export type VideoTranscript = {
  transcript: string;
  source: 'captions';
};

// Optimizer Phase 6: channel-level totals for the "Insights feed" home
// screen's subscriber/view milestone progress bars.
export type ChannelStats = {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
};

// Optimizer Phase 6: a public video used to benchmark AI title suggestions
// against real competing content (feature inventory item 6, "competitive
// benchmarking"). Deliberately thin - just enough to show "similar videos
// are getting N views with titles like this" alongside a suggestion.
export type SimilarVideo = {
  title: string;
  channelTitle: string;
  viewCount: string;
};

export interface SocialProvider
  extends IAuthenticator,
    ISocialMediaIntegration {
  identifier: string;
  refreshWait?: boolean;
  convertToJPEG?: boolean;
  stripLinks?: () => boolean;
  refreshCron?: boolean;
  dto?: any;
  maxLength: (additionalSettings?: any, settings?: any) => number;
  checkValidity(
    posts: Array<{ path: string; thumbnail?: string }[]>,
    settings: any,
    additionalSettings: any[]
  ): Promise<string | true>;
  checkPostStatus(
    accessToken: string,
    pendingData: any,
    integration: Integration
  ): Promise<PendingCheckResponse>;
  finalizePost(
    accessToken: string,
    pendingData: any,
    integration: Integration
  ): Promise<PendingCheckResponse>;
  isWeb3?: boolean;
  isChromeExtension?: boolean;
  extensionCookies?: { name: string; domain: string }[];
  editor: 'none' | 'normal' | 'markdown' | 'html';
  customFields?: () => Promise<
    {
      key: string;
      label: string;
      defaultValue?: string;
      validation: string;
      type: 'text' | 'password';
      hint?: string;
    }[]
  >;
  name: string;
  toolTip?: string;
  oneTimeToken?: boolean;
  isBetweenSteps: boolean;
  scopes: string[];
  externalUrl?: (
    url: string
  ) => Promise<{ client_id: string; client_secret: string }>;
  mention?: (
    token: string,
    data: { query: string },
    id: string,
    integration: Integration
  ) => Promise<
    | { id: string; label: string; image: string; doNotCache?: boolean }[]
    | { none: true }
  >;
  mentionFormat?(idOrHandle: string, name: string): string;
  fetchPageInformation?(
    accessToken: string,
    data: any
  ): Promise<FetchPageInformationResult>;
  // Optional: providers that expose a video library (currently just YouTube)
  // implement these so the optimizer feature can list/inspect videos without
  // any provider-specific branching in generic controller/service code -
  // callers always go through IntegrationManager.getSocialIntegration() and
  // check `if (provider.listVideos)` rather than importing YoutubeProvider.
  listVideos?(
    accessToken: string,
    channelId: string,
    pageToken?: string
  ): Promise<{ videos: VideoListItem[]; nextPageToken?: string }>;
  getVideoDetails?(
    accessToken: string,
    videoId: string
  ): Promise<VideoDetails | undefined>;
  // Optimizer Phase 2: applies AI-generated title/description/tag suggestions
  // back to the platform. Only the fields present in `data` are changed.
  updateVideoMetadata?(
    accessToken: string,
    videoId: string,
    data: { title?: string; description?: string; tags?: string[] }
  ): Promise<{ success: boolean }>;
  // Optimizer Phase 3: sets an already-uploaded image (a path/URL our own
  // storage can serve, e.g. from MediaService.generateImage + storage upload)
  // as the video's thumbnail.
  setVideoThumbnail?(
    accessToken: string,
    videoId: string,
    thumbnailUrl: string
  ): Promise<{ success: boolean }>;
  // Optimizer Phase 4: top-level comment threads for a video, with whether
  // the channel owner (authorChannelId === channelId) has already replied -
  // the caller filters on that to build an "unanswered comments" list rather
  // than this method doing the filtering itself, keeping it a plain read.
  listComments?(
    accessToken: string,
    videoId: string,
    channelId: string
  ): Promise<VideoComment[]>;
  replyToComment?(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<{ success: boolean }>;
  // Optimizer Phase 5: the video's caption track as a timestamped transcript,
  // used for the Review tab's captions-only critique (see plan 3d, v1 scope).
  // Returns undefined when no caption track exists for the video - the
  // Review tab must handle this as a real, user-facing "not available" case
  // rather than an error.
  getTranscript?(
    accessToken: string,
    videoId: string
  ): Promise<VideoTranscript | undefined>;
  // Optimizer Phase 6: channel totals for the milestone progress bars.
  getChannelStats?(
    accessToken: string,
    channelId: string
  ): Promise<ChannelStats | undefined>;
  // Optimizer Phase 6: public search for competitive benchmarking - results
  // belonging to `excludeChannelId` are filtered out by the caller so a
  // channel never gets "benchmarked" against its own videos.
  searchSimilarVideos?(
    accessToken: string,
    query: string,
    excludeChannelId: string
  ): Promise<SimilarVideo[]>;
}
