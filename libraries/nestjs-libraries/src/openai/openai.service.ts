import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

const YoutubeTitleSuggestionsSchema = z.object({
  currentScore: z.number().min(0).max(100),
  suggestions: z
    .array(
      z.object({
        title: z.string(),
        predictedScore: z.number().min(0).max(100),
        rationale: z.string(),
      })
    )
    .length(3),
});
export type YoutubeTitleSuggestions = z.infer<
  typeof YoutubeTitleSuggestionsSchema
>;

const YoutubeSeoSuggestionsSchema = z.object({
  description: z.string(),
  tags: z
    .array(
      z.object({
        tag: z.string(),
        relevance: z.number().min(0).max(100),
      })
    )
    .max(15),
});
export type YoutubeSeoSuggestions = z.infer<typeof YoutubeSeoSuggestionsSchema>;

const YoutubeThumbnailFeedbackSchema = z.object({
  score: z.number().min(0).max(100),
  pros: z.array(z.string()).max(4),
  cons: z.array(z.string()).max(4),
});
export type YoutubeThumbnailFeedback = z.infer<
  typeof YoutubeThumbnailFeedbackSchema
>;

const YoutubeCommentReplySchema = z.object({
  reply: z.string(),
});
export type YoutubeCommentReplyDraft = z.infer<
  typeof YoutubeCommentReplySchema
>;

// YouTube Optimizer Phase 5 (Review tab). `timestamp` must be one of the
// literal "mm:ss" markers present in the transcript passed to the model -
// it's what the frontend uses to seek the embedded player, so an invented
// timestamp would seek to the wrong (or a nonexistent) moment.
const YoutubeVideoReviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  categories: z
    .array(
      z.object({
        category: z.enum([
          'hook',
          're_hooks_pacing',
          'broll_editing',
          'cta',
        ]),
        items: z
          .array(
            z.object({
              timestamp: z.string(),
              severity: z.enum(['low', 'medium', 'high']),
              note: z.string(),
            })
          )
          .max(6),
      })
    )
    .length(4),
});
export type YoutubeVideoReview = z.infer<typeof YoutubeVideoReviewSchema>;

@Injectable()
export class OpenaiService {
  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: 'gpt-4.1',
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: 'gpt-4.1',
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  // YouTube Optimizer Phase 2: title-rewrite and SEO/tag suggestions, same
  // structured-output pattern as generatePromptForPicture/generatePosts above.
  // `similarVideos` (Optimizer Phase 6) is optional competitive-benchmarking
  // context - real videos on the same topic and their view counts, fetched
  // by the caller via SocialProvider.searchSimilarVideos. When present, the
  // model is asked to ground its rationale in what's actually working for
  // that content rather than generic copywriting advice; when absent (no
  // provider support, or the search came back empty), the prompt degrades
  // gracefully to the original Phase 2 behavior.
  async generateYoutubeTitleSuggestions(
    title: string,
    description: string,
    tags: string[],
    similarVideos: { title: string; channelTitle: string; viewCount: string }[] = []
  ): Promise<YoutubeTitleSuggestions> {
    const benchmarkContext = similarVideos.length
      ? `\n\nFor competitive context, here are real videos currently performing well on a similar topic (title - channel - view count):\n${similarVideos
          .map((v) => `- "${v.title}" - ${v.channelTitle} - ${v.viewCount} views`)
          .join(
            '\n'
          )}\nUse these only as a reference for what phrasing/format is resonating on this topic right now - do not copy them or misrepresent this video's content to match.`
      : '';

    const parsed = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              'You are a YouTube SEO and click-through-rate expert. Given a video\'s current title, description and tags, score the current title out of 100 for click-through potential and searchability, then generate exactly 3 alternative titles that would likely perform better - each with a predicted score out of 100 and a one-sentence rationale. Keep titles under 100 characters, avoid clickbait that misrepresents the content, and keep them consistent with the video\'s actual topic.',
          },
          {
            role: 'user',
            content: `Current title: ${title}\n\nDescription: ${description}\n\nTags: ${tags.join(
              ', '
            )}${benchmarkContext}`,
          },
        ],
        response_format: zodResponseFormat(
          YoutubeTitleSuggestionsSchema,
          'titleSuggestions'
        ),
      })
    ).choices[0].message.parsed;

    if (!parsed) {
      throw new Error('The AI did not return a valid response, please try again');
    }

    return parsed;
  }

  async generateYoutubeSeoSuggestions(
    title: string,
    description: string,
    tags: string[]
  ): Promise<YoutubeSeoSuggestions> {
    const parsed = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              "You are a YouTube SEO expert. Given a video's current title, description and tags, rewrite the description to be more discoverable (keep the creator's voice and any links/calls-to-action, but improve the opening lines for search and naturally add relevant keywords), and suggest up to 15 tags ordered by relevance (0-100) that would help this video get discovered. Do not invent facts about the video that aren't implied by the existing title/description.",
          },
          {
            role: 'user',
            content: `Current title: ${title}\n\nCurrent description: ${description}\n\nCurrent tags: ${tags.join(
              ', '
            )}`,
          },
        ],
        response_format: zodResponseFormat(
          YoutubeSeoSuggestionsSchema,
          'seoSuggestions'
        ),
      })
    ).choices[0].message.parsed;

    if (!parsed) {
      throw new Error('The AI did not return a valid response, please try again');
    }

    return parsed;
  }

  // YouTube Optimizer Phase 3: scores a generated thumbnail candidate against
  // the video's title/description via a vision-capable gpt-4.1 call - a
  // multimodal chat.completions.parse request (text + image_url content
  // parts), same structured-output mechanism as the other Youtube* methods
  // above, just with an image attached to the user message.
  async generateYoutubeThumbnailFeedback(
    imageDataUrl: string,
    title: string,
    description: string
  ): Promise<YoutubeThumbnailFeedback> {
    const parsed = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              "You are a YouTube thumbnail expert. Given a candidate thumbnail image and the video's title/description, score the thumbnail out of 100 for click-through potential (contrast, readability at small size, clarity of subject, emotional pull), then list up to 4 specific pros and up to 4 specific cons or improvement suggestions.",
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Video title: ${title}\n\nDescription: ${description}`,
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        response_format: zodResponseFormat(
          YoutubeThumbnailFeedbackSchema,
          'thumbnailFeedback'
        ),
      })
    ).choices[0].message.parsed;

    if (!parsed) {
      throw new Error('The AI did not return a valid response, please try again');
    }

    return parsed;
  }

  // YouTube Optimizer Phase 4: drafts a reply to a viewer comment. Kept short
  // and in the creator's voice rather than a support-ticket tone - this is
  // shown to the creator for review before it's ever posted (never sent
  // automatically), same "review before sending" contract the frontend
  // enforces in its own UI.
  async generateYoutubeCommentReply(
    commentText: string,
    videoTitle: string
  ): Promise<YoutubeCommentReplyDraft> {
    const parsed = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              "You are a YouTube creator's assistant drafting a reply to a viewer comment. Keep it short (1-3 sentences), friendly, on-topic, and in the voice of a creator replying to their own audience - not a corporate support agent. Do not use hashtags, and only use emojis if the viewer's comment used them first.",
          },
          {
            role: 'user',
            content: `Video title: ${videoTitle}\n\nViewer comment: ${commentText}`,
          },
        ],
        response_format: zodResponseFormat(
          YoutubeCommentReplySchema,
          'commentReply'
        ),
      })
    ).choices[0].message.parsed;

    if (!parsed) {
      throw new Error('The AI did not return a valid response, please try again');
    }

    return parsed;
  }

  // YouTube Optimizer Phase 5: captions-only video critique (v1 scope per
  // YOUTUBE_OPTIMIZER_PLAN.md 3d - no frame sampling, transcript only). The
  // system prompt explicitly tells the model it cannot see the video, so it
  // doesn't hallucinate visual details (lighting, on-screen text, b-roll
  // content) it has no basis for - "B-roll & Editing" feedback is meant to
  // stay conservative, inferred only from pacing/narration cues in the
  // transcript (e.g. long unbroken monologue segments), not invented visuals.
  async generateYoutubeVideoReview(
    transcript: string,
    title: string,
    description: string
  ): Promise<YoutubeVideoReview> {
    const parsed = (
      await openai.chat.completions.parse({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content:
              'You are a YouTube video coach reviewing a video from its transcript only - you cannot see the video, so never invent visual details (lighting, on-screen text, camera work); base every note only on what the transcript/timestamps imply. Return feedback for exactly 4 categories, in this order: "hook" (does the first ~15 seconds earn a click-through/watch, is the value proposition clear immediately), "re_hooks_pacing" (does the video keep re-engaging the viewer over time, are there pacing issues like a long unbroken stretch on one topic), "broll_editing" (only flag pacing/monologue cues that suggest a visual lull - be conservative and say so if the transcript gives little basis for this category), "cta" (calls to action, subscribe asks, end-of-video wrap-up). Each item\'s "timestamp" MUST be copied exactly from one of the "[mm:ss]" markers in the transcript provided - never invent a timestamp. Give each category 0-6 items; an empty items array is fine if there is nothing notable for that category. Also give an overall score out of 100 and a 2-3 sentence summary.',
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nDescription: ${description}\n\nTranscript (timestamped):\n${transcript}`,
          },
        ],
        response_format: zodResponseFormat(
          YoutubeVideoReviewSchema,
          'videoReview'
        ),
      })
    ).choices[0].message.parsed;

    if (!parsed) {
      throw new Error('The AI did not return a valid response, please try again');
    }

    return parsed;
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        const parse =
          (
            await openai.chat.completions.parse({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }
}
