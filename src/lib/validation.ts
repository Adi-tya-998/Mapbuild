import { z } from 'zod';
import { LABEL_LIMITS, SHEET_SIZE } from '../types/map';
import type { EdgeGap, EdgeOutline, MapObject, Outline, Point } from '../types/map';
import { FILE_APP, FILE_VERSION } from '../types/project';
import type { Background, MapDocument, ProjectFile } from '../types/project';
import { clamp } from './geometry';
import { createId } from './id';

const MAX_SHAPES = 2000;
const MAX_POINTS = 500;
const MAX_NAME = 60;
const layerName = z.string().max(MAX_NAME).optional();
const elevation = z.number().finite().transform((value) => clamp(value, -10, 10)).optional();
const outlineWidth = z.number().finite().transform((value) => clamp(value, 0.25, 8)).optional();
const COORD_MARGIN = 20;
const MAX_DATA_URL = 20 * 1024 * 1024;

const coord = z
  .number()
  .finite()
  .transform((v) => clamp(v, -COORD_MARGIN, SHEET_SIZE + COORD_MARGIN));
const point = z.tuple([coord, coord]);
const kind = z.enum(['floor', 'lane', 'site', 'cut']);
const outline = z.enum(['none', 'white', 'black']).optional();
const edgeOutlines = z.array(z.enum(['none', 'white', 'black']).nullable().optional()).max(MAX_POINTS).optional();
const edgeWidths = z.array(z.number().finite().transform((value) => clamp(value, 0.25, 8))).max(MAX_POINTS).optional();
const edgeGaps = z.array(z.array(z.tuple([
  z.number().finite().transform((value) => clamp(value, 0, 1)),
  z.number().finite().transform((value) => clamp(value, 0, 1)),
])).max(500)).max(MAX_POINTS).optional();
const erasures = z.array(z.array(point).min(1).max(MAX_POINTS)).max(500).optional();
const groupId = z.string().max(100).optional();

const labelSchema = z
  .object({
    type: z.literal('label'),
    name: layerName,
    groupId,
    groupName: layerName,
    pts: z.array(point).min(1),
    text: z.string().optional(),
    size: z.number().finite().optional(),
    tone: z.string().optional(),
    hidden: z.boolean().optional(),
    outline,
    outlineWidth,
    edgeOutlines,
    edgeWidths,
    edgeGaps,
    erasures,
  })
  .transform(
    (s): MapObject => ({
      id: createId(),
      name: s.name,
      groupId: s.groupId,
      groupName: s.groupName,
      type: 'label',
      pts: [s.pts[0] as Point],
      text: (s.text ?? '').slice(0, LABEL_LIMITS.maxText),
      size: clamp(s.size ?? 12, LABEL_LIMITS.minSize, LABEL_LIMITS.maxSize),
      tone: s.tone === 'dark' ? 'dark' : 'light',
      hidden: s.hidden ? true : undefined,
      outline: s.outline,
      outlineWidth: s.outlineWidth,
      edgeOutlines: s.edgeOutlines as EdgeOutline[] | undefined,
      edgeWidths: s.edgeWidths,
      edgeGaps: s.edgeGaps as EdgeGap[][] | undefined,
      erasures: s.erasures as Point[][] | undefined,
    }),
  );

const lineSchema = z.object({
  type: z.enum(['line', 'curve']),
  name: layerName,
  groupId,
  groupName: layerName,
  kind,
  pts: z.array(point).min(2).max(MAX_POINTS),
  hidden: z.boolean().optional(),
  outline,
  outlineWidth,
  edgeOutlines,
  edgeWidths,
  edgeGaps,
  erasures,
}).transform((s): MapObject => ({
  id: createId(),
  name: s.name,
  groupId: s.groupId,
  groupName: s.groupName,
  type: s.type,
  kind: s.kind,
  pts: s.pts as Point[],
  hidden: s.hidden ? true : undefined,
  outline: s.outline as Outline | undefined,
  outlineWidth: s.outlineWidth,
  edgeOutlines: s.edgeOutlines as EdgeOutline[] | undefined,
  edgeWidths: s.edgeWidths,
  edgeGaps: s.edgeGaps as EdgeGap[][] | undefined,
  erasures: s.erasures as Point[][] | undefined,
}));

// Files from the original editor flag rectangles with `rect: true`; anything else with a rect type becomes a polygon.
const filledSchema = z
  .object({
    type: z.enum(['poly', 'rect']),
    name: layerName,
    groupId,
    groupName: layerName,
    kind,
    elevation,
    pts: z.array(point).min(3).max(MAX_POINTS),
    rect: z.boolean().optional(),
    hidden: z.boolean().optional(),
    outline,
    outlineWidth,
    edgeOutlines,
    edgeWidths,
    edgeGaps,
    erasures,
  })
  .transform((s): MapObject => {
    const isRect = s.type === 'rect' && s.pts.length === 4 && s.rect === true;
    return {
      id: createId(),
      name: s.name,
      groupId: s.groupId,
      groupName: s.groupName,
      type: isRect ? 'rect' : 'poly',
      kind: s.kind,
      elevation: s.elevation,
      pts: s.pts as Point[],
      hidden: s.hidden ? true : undefined,
      outline: s.outline,
      outlineWidth: s.outlineWidth,
      edgeOutlines: s.edgeOutlines as EdgeOutline[] | undefined,
      edgeWidths: s.edgeWidths,
      edgeGaps: s.edgeGaps as EdgeGap[][] | undefined,
      erasures: s.erasures as Point[][] | undefined,
    };
  });

const circleSchema = z.object({
  type: z.literal('circle'),
  name: layerName,
  groupId,
  groupName: layerName,
  kind,
  elevation,
  pts: z.array(point).length(2),
  hidden: z.boolean().optional(),
  outline,
  outlineWidth,
  edgeOutlines,
  edgeWidths,
  edgeGaps,
  erasures,
}).transform((s): MapObject => ({
  id: createId(),
  name: s.name,
  groupId: s.groupId,
  groupName: s.groupName,
  type: 'circle',
  kind: s.kind,
  elevation: s.elevation,
  pts: s.pts as Point[],
  hidden: s.hidden ? true : undefined,
  outline: s.outline,
  outlineWidth: s.outlineWidth,
  edgeOutlines: s.edgeOutlines as EdgeOutline[] | undefined,
  edgeWidths: s.edgeWidths,
  edgeGaps: s.edgeGaps as EdgeGap[][] | undefined,
  erasures: s.erasures as Point[][] | undefined,
}));

const shapeSchema = z.union([labelSchema, lineSchema, circleSchema, filledSchema]);

const backgroundSchema = z.object({
  dataUrl: z
    .string()
    .max(MAX_DATA_URL)
    .regex(/^data:image\/(png|jpeg|webp);base64,/),
  opacity: z.number().finite().optional(),
  visible: z.boolean().optional(),
});

const fileSchema = z.object({
  app: z.string().optional(),
  version: z.number().optional(),
  name: z.string().optional(),
  shapes: z.array(z.unknown()),
  background: z.unknown().optional(),
});

export interface ParseResult {
  doc: MapDocument;
  /** Shapes (or the background image) that were present but invalid and were dropped. */
  skipped: number;
}

export class ProjectParseError extends Error {}

/** Validate unknown data (parsed JSON or a stored record) as a project. Invalid shapes are skipped, not fatal. */
export function parseProject(data: unknown): ParseResult {
  const file = fileSchema.safeParse(data);
  if (!file.success) throw new ProjectParseError('This file is not a Minimap Maker map.');
  const { shapes: raw, name, background: rawBackground } = file.data;

  const shapes: MapObject[] = [];
  let skipped = Math.max(0, raw.length - MAX_SHAPES);
  for (const item of raw.slice(0, MAX_SHAPES)) {
    const r = shapeSchema.safeParse(item);
    if (r.success) shapes.push(r.data);
    else skipped += 1;
  }

  let background: Background | null = null;
  if (rawBackground != null) {
    const b = backgroundSchema.safeParse(rawBackground);
    if (b.success) {
      background = {
        dataUrl: b.data.dataUrl,
        opacity: clamp(b.data.opacity ?? 0.5, 0, 1),
        visible: b.data.visible ?? true,
      };
    } else {
      skipped += 1;
    }
  }

  return { doc: { name: (name ?? 'Untitled map').slice(0, MAX_NAME), shapes, background }, skipped };
}

export function parseProjectText(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectParseError('That file is not valid JSON.');
  }
  return parseProject(data);
}

export function serializeProject(doc: MapDocument): ProjectFile {
  return {
    app: FILE_APP,
    version: FILE_VERSION,
    name: doc.name,
    size: SHEET_SIZE,
    // Rectangles carry `rect: true` so the original HTML editor can still open exported files.
    shapes: doc.shapes.map((s) => {
      const { id: _id, ...rest } = s;
      return s.type === 'rect' ? { ...rest, rect: true } : rest;
    }),
    ...(doc.background ? { background: doc.background } : {}),
  };
}
