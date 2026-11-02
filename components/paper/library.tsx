"use client";

// The Hackerpaper catalog: every component a generated edition may use.
// Zod key order is the positional argument order in OpenUI Lang, so required props come first.
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { ArticleQuote, ArticleSummary } from "./Article";
import { Colophon, OpenQuestions, ReadingList } from "./Closing";
import { Headline, Lede } from "./Headline";
import { Edition, Sidebar, Story } from "./Paper";
import { Positions } from "./Positions";
import { Exchange, PullQuote } from "./Quote";
import { LeadArt } from "./LeadArt";
import { KeyPoints, Prose, Section } from "./Section";
import { ThreadMap } from "./ThreadMap";

// ─── Parts: data passed to other components, never rendered on their own ─────

const QuotePart = defineComponent({
  name: "Quote",
  props: z.object({
    id: z.number(),
    excerpt: z.string().optional(),
  }),
  description:
    "A comment from the thread, by id. excerpt must be copied character for character from that comment; omit it to quote the whole comment.",
  component: () => null,
});

const TermPart = defineComponent({
  name: "Term",
  props: z.object({
    term: z.string(),
    definition: z.string(),
  }),
  description:
    "A word in a Prose text to define for the reader. term must appear exactly in the text. The definition is added context and is shown apart from the thread.",
  component: () => null,
});

const SidePart = defineComponent({
  name: "Side",
  props: z.object({
    label: z.string(),
    summary: z.string(),
    quotes: z.array(QuotePart.ref),
  }),
  description: "One side of a disagreement: a short label, a one-sentence summary, and the comments that argue it.",
  component: () => null,
});

const QuestionPart = defineComponent({
  name: "Question",
  props: z.object({
    question: z.string(),
    id: z.number(),
  }),
  description: "A question the thread left unsettled, and the id of the comment that raised it.",
  component: () => null,
});

const ResourcePart = defineComponent({
  name: "Resource",
  props: z.object({
    name: z.string(),
    note: z.string(),
    url: z.string().optional(),
    ids: z.array(z.number()).optional(),
  }),
  description:
    "Something worth following up. url must be a link that appears in the thread; for things named without a link, omit url and give the ids of the comments that mention it.",
  component: () => null,
});

const ResourceGroupPart = defineComponent({
  name: "ResourceGroup",
  props: z.object({
    title: z.string(),
    items: z.array(ResourcePart.ref),
  }),
  description: "A titled group of resources.",
  component: () => null,
});

// ─── Blocks inside a Section ─────────────────────────────────────────────────

const ProseBlock = defineComponent({
  name: "Prose",
  props: z.object({
    text: z.string(),
    cites: z.array(QuotePart.ref).optional(),
    terms: z.array(TermPart.ref).optional(),
  }),
  description:
    "A paragraph in the editor's voice: report and paraphrase, the way a newspaper does. Plain text, no markdown. To quote a commenter, write {1}, {2}… where their words go and list the Quotes in cites (each excerpt a short phrase or sentence); the page prints the excerpt in quotation marks with the commenter's name. Never type quoted words or quotation marks around someone's words yourself. Terms are marked inline and defined after the paragraph.",
  component: ({ props }) => (
    <Prose
      text={props.text}
      cites={(props.cites ?? []).map((q) => q.props)}
      terms={(props.terms ?? []).map((t) => t.props)}
    />
  ),
});

const PullQuoteBlock = defineComponent({
  name: "PullQuote",
  props: z.object({
    id: z.number(),
    excerpt: z.string().optional(),
  }),
  description:
    "A large display quote of one comment. Use sparingly, at most one or two per edition, for a line that sums up a whole debate.",
  component: ({ props }) => <PullQuote id={props.id} excerpt={props.excerpt} />,
});

const ExchangeBlock = defineComponent({
  name: "Exchange",
  props: z.object({
    quotes: z.array(QuotePart.ref),
  }),
  description:
    "A back-and-forth printed as a transcript. Use rarely: usually it reads better told in Prose with cites. Each quote must be a direct reply to the one before it, or nothing renders.",
  component: ({ props }) => <Exchange quotes={props.quotes.map((q) => q.props)} />,
});

const PositionsBlock = defineComponent({
  name: "Positions",
  props: z.object({
    question: z.string(),
    sides: z.array(SidePart.ref),
  }),
  description:
    "Where the thread splits, as 2 or 3 sides with the comments behind each, shown in one row. More than 3 sides are folded into an \"Others\" side, so prefer 2 or 3. Shows how the cited comments divide; never declares a winner.",
  component: ({ props }) => (
    <Positions
      question={props.question}
      sides={props.sides.map((s) => ({ ...s.props, quotes: s.props.quotes.map((q) => q.props) }))}
    />
  ),
});

const ArticleSummaryBlock = defineComponent({
  name: "ArticleSummary",
  props: z.object({
    title: z.string(),
    points: z.array(z.string()),
  }),
  description: "What the linked article says, as short points, kept visibly apart from what commenters said.",
  component: ({ props }) => <ArticleSummary title={props.title} points={props.points} />,
});

const ArticleQuoteBlock = defineComponent({
  name: "ArticleQuote",
  props: z.object({
    text: z.string(),
  }),
  description: "A quote from the linked article. Must be copied exactly from the article, or nothing renders.",
  component: ({ props }) => <ArticleQuote text={props.text} />,
});

const KeyPointsBlock = defineComponent({
  name: "KeyPoints",
  props: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
  description: "A numbered summary box: 3 to 5 one-sentence takeaways.",
  component: ({ props }) => <KeyPoints title={props.title} items={props.items} />,
});

const OpenQuestionsBlock = defineComponent({
  name: "OpenQuestions",
  props: z.object({
    items: z.array(QuestionPart.ref),
  }),
  description: "Questions the thread raised and didn't settle.",
  component: ({ props }) => <OpenQuestions items={props.items.map((q) => q.props)} />,
});

const ReadingListBlock = defineComponent({
  name: "ReadingList",
  props: z.object({
    groups: z.array(ResourceGroupPart.ref),
  }),
  description: "Links and tools from the thread, grouped. Credits who mentioned each one.",
  component: ({ props }) => (
    <ReadingList groups={props.groups.map((g) => ({ ...g.props, items: g.props.items.map((r) => r.props) }))} />
  ),
});

const LeadArtBlock = defineComponent({
  name: "LeadArt",
  props: z.object({
    src: z.string(),
    caption: z.string(),
    credit: z.string(),
  }),
  description:
    "An image printed in black and white, like a newspaper photo. Use the image you are given; never invent a src. caption says what it shows in one sentence; credit names the source (e.g. \"Screenshot of example.com\").",
  component: ({ props }) => <LeadArt src={props.src} caption={props.caption} credit={props.credit} />,
});

const SECTION_BLOCKS = [
  ProseBlock,
  PullQuoteBlock,
  ExchangeBlock,
  PositionsBlock,
  LeadArtBlock,
  ArticleSummaryBlock,
  ArticleQuoteBlock,
  KeyPointsBlock,
  OpenQuestionsBlock,
  ReadingListBlock,
] as const;

const SectionBlock = defineComponent({
  name: "Section",
  props: z.object({
    title: z.string(),
    blocks: z.array(z.union(SECTION_BLOCKS.map((b) => b.ref))),
  }),
  description: "A titled part of the story or sidebar. In the Story its text is set in two columns.",
  component: ({ props, renderNode }) => <Section title={props.title}>{renderNode(props.blocks)}</Section>,
});

// ─── Page structure ──────────────────────────────────────────────────────────

const HeadlineBlock = defineComponent({
  name: "Headline",
  props: z.object({
    kicker: z.string(),
    title: z.string(),
    dek: z.string(),
  }),
  description:
    "The banner: a short section label (kicker), an editor's headline about what the thread is really about, and a one-sentence summary (dek).",
  component: ({ props }) => <Headline kicker={props.kicker} title={props.title} dek={props.dek} />,
});

const ThreadMapBlock = defineComponent({
  name: "ThreadMap",
  props: z.object({
    comments: z.array(
      z.object({
        id: z.number(),
        parent: z.number(),
        depth: z.number(),
        hours: z.number(),
      }),
    ),
    quoted: z.array(z.number()).optional(),
  }),
  description:
    "The lead graphic: every comment plotted by time and reply depth. comments is the comments list from the get_comment_timeline Query. Comments quoted on the page are marked automatically; quoted is optional.",
  component: ({ props }) => <ThreadMap comments={props.comments ?? []} quoted={props.quoted ?? []} />,
});

const LedeBlock = defineComponent({
  name: "Lede",
  props: z.object({
    text: z.string(),
  }),
  description: "The opening paragraph of the story, set large with a drop cap. 3 to 5 sentences.",
  component: ({ props }) => <Lede>{props.text}</Lede>,
});

const StoryBlock = defineComponent({
  name: "Story",
  props: z.object({
    blocks: z.array(z.union([LeadArtBlock.ref, LedeBlock.ref, SectionBlock.ref])),
  }),
  description: "The main story: an optional LeadArt, a Lede, then Sections.",
  component: ({ props, renderNode }) => <Story>{renderNode(props.blocks)}</Story>,
});

const SidebarBlock = defineComponent({
  name: "Sidebar",
  props: z.object({
    blocks: z.array(z.union([KeyPointsBlock.ref, SectionBlock.ref])),
  }),
  description: "The column beside the story: KeyPoints, then Sections for open questions and reading.",
  component: ({ props, renderNode }) => <Sidebar>{renderNode(props.blocks)}</Sidebar>,
});

const ColophonBlock = defineComponent({
  name: "Colophon",
  props: z.object({}),
  description: "The closing note on how the edition was made. Always last.",
  component: () => <Colophon />,
});

const EditionBlock = defineComponent({
  name: "Edition",
  props: z.object({
    blocks: z.array(z.union([HeadlineBlock.ref, ThreadMapBlock.ref, StoryBlock.ref, SidebarBlock.ref, ColophonBlock.ref])),
  }),
  description: "The whole page, in order: Headline, ThreadMap, Story, Sidebar, Colophon.",
  component: ({ props, renderNode }) => <Edition>{renderNode(props.blocks)}</Edition>,
});

export const library = createLibrary({
  root: "Edition",
  components: [
    EditionBlock,
    HeadlineBlock,
    ThreadMapBlock,
    StoryBlock,
    SidebarBlock,
    ColophonBlock,
    LedeBlock,
    SectionBlock,
    ...SECTION_BLOCKS,
    QuotePart,
    TermPart,
    SidePart,
    QuestionPart,
    ResourcePart,
    ResourceGroupPart,
  ],
  componentGroups: [
    { name: "Page", components: ["Edition", "Headline", "ThreadMap", "Story", "Sidebar", "Colophon"] },
    { name: "Story", components: ["LeadArt", "Lede", "Section", "Prose", "PullQuote", "Exchange", "Positions"] },
    { name: "Article", components: ["ArticleSummary", "ArticleQuote"] },
    { name: "Sidebar", components: ["KeyPoints", "OpenQuestions", "ReadingList"] },
    { name: "Parts", components: ["Quote", "Term", "Side", "Question", "Resource", "ResourceGroup"] },
  ],
});

// Re-exported so `openui generate` picks the prompt options up alongside the library.
export { promptOptions } from "./prompt";
