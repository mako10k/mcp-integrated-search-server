import axios from "axios";

interface NamedEntity {
  id: number;
  name: string;
}

type FieldType = "tracker" | "status" | "priority";

export interface ResolveFieldOptions {
  value?: number | string | null;
  repositoryId: string;
  baseUrl: string;
  headers: Record<string, string>;
  fieldLabel: string;
}

interface CacheEntry {
  tracker: Map<string, NamedEntity[]>;
  status: Map<string, NamedEntity[]>;
  priority: Map<string, NamedEntity[]>;
}

export class RedmineFieldResolver {
  private cache: CacheEntry = {
    tracker: new Map(),
    status: new Map(),
    priority: new Map(),
  };

  async resolveTracker(options: ResolveFieldOptions): Promise<number | undefined> {
    return this.resolveField("tracker", options);
  }

  async resolveStatus(options: ResolveFieldOptions): Promise<number | undefined> {
    return this.resolveField("status", options);
  }

  async resolvePriority(options: ResolveFieldOptions): Promise<number | undefined> {
    return this.resolveField("priority", options);
  }

  clearCache(): void {
    this.cache.tracker.clear();
    this.cache.status.clear();
    this.cache.priority.clear();
  }

  private async resolveField(type: FieldType, options: ResolveFieldOptions): Promise<number | undefined> {
    const { value } = options;

    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    // Allow numeric strings
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && Number.isInteger(asNumber) && asNumber > 0) {
      return asNumber;
    }

    const entities = await this.getEntities(type, options);
    const normalized = trimmed.toLowerCase();

    const exact = entities.find((entity) => entity.name.toLowerCase() === normalized);
    if (exact) {
      return exact.id;
    }

    const partialMatches = entities.filter((entity) =>
      entity.name.toLowerCase().includes(normalized)
    );

    if (partialMatches.length === 1) {
      return partialMatches[0].id;
    }

    if (partialMatches.length === 0) {
      const available = entities.map((entity) => entity.name).join(", ");
      throw new Error(
        `${options.fieldLabel} '${value}' not found. Available values: ${available}`
      );
    }

    const matches = partialMatches.map((entity) => entity.name).join(", ");
    throw new Error(
      `${options.fieldLabel} '${value}' is ambiguous. Possible matches: ${matches}`
    );
  }

  private async getEntities(
    type: FieldType,
    options: ResolveFieldOptions
  ): Promise<NamedEntity[]> {
    const cacheKey = `${options.repositoryId}`;
    const cache = this.cache[type];

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const endpoint = this.getEndpoint(type);
    const responseKey = this.getResponseKey(type);
    const url = `${options.baseUrl}${endpoint}`;

    const response = await axios.get(url, {
      headers: options.headers,
      timeout: 10000,
    });

    const raw = response.data?.[responseKey];
    if (!Array.isArray(raw)) {
      throw new Error(
        `Unexpected response for ${type}: missing '${responseKey}' array`
      );
    }

    const mapped = raw.map((entity: NamedEntity) => ({
      id: entity.id,
      name: entity.name,
    }));

    cache.set(cacheKey, mapped);
    return mapped;
  }

  private getEndpoint(type: FieldType): string {
    switch (type) {
      case "tracker":
        return "/trackers.json";
      case "status":
        return "/issue_statuses.json";
      case "priority":
        return "/enumerations/issue_priorities.json";
      default:
        throw new Error(`Unsupported field type: ${type}`);
    }
  }

  private getResponseKey(type: FieldType): string {
    switch (type) {
      case "tracker":
        return "trackers";
      case "status":
        return "issue_statuses";
      case "priority":
        return "issue_priorities";
      default:
        throw new Error(`Unsupported field type: ${type}`);
    }
  }
}
