/**
 * TOOL CONFIGURATION
 *
 * Update these values for each new tool.
 * This is the single source of truth for tool-specific settings.
 */

export const TOOL_CONFIG = {
  /** Display name of the tool (e.g. "JSON Formatter") */
  name: 'SVG to PNG Converter',

  /** Short tagline (e.g. "Format and validate JSON instantly") */
  tagline: 'Convert SVG to high-quality PNG images instantly',

  /** Full URL of the deployed tool */
  url: 'https://free-svg-to-png.codama.dev/',

  /** localStorage key prefix to avoid collisions between tools */
  storagePrefix: 'codama-svg-to-png',
} as const
