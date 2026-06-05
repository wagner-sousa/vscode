/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IAgentSkill } from '../../../../common/promptSyntax/service/promptsService.js';

/**
 * Words that are too common to be meaningful skill triggers. Matching them would
 * underline most of the message, so they are excluded from the heuristic index.
 * Kept small and lowercase; covers frequent English and Portuguese filler words.
 */
export const SKILL_KEYWORD_STOPWORDS = new Set<string>([
	// english
	'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'are', 'was', 'use', 'used', 'using',
	'can', 'will', 'should', 'would', 'when', 'what', 'which', 'how', 'all', 'any', 'not', 'but', 'has', 'have', 'its',
	'file', 'files', 'code', 'codes', 'text', 'line', 'lines', 'name', 'names', 'list', 'help',
	// portuguese
	'que', 'com', 'para', 'por', 'dos', 'das', 'uma', 'uns', 'umas', 'isso', 'este', 'esta', 'esse', 'essa', 'aos',
	'como', 'quando', 'qual', 'quais', 'todo', 'toda', 'todos', 'todas', 'nao', 'mais', 'seu', 'sua', 'meu', 'minha',
	'arquivo', 'arquivos', 'codigo', 'linha', 'linhas', 'nome', 'nomes', 'lista', 'ajuda',
]);

/** Minimum length of a token to be considered a meaningful skill keyword. */
export const SKILL_KEYWORD_MIN_LENGTH = 3;

/**
 * Build the set of meaningful keywords for a skill from its name and description.
 * The name is split on hyphens, underscores and camelCase boundaries; the
 * description is tokenized into words. Short tokens and stopwords are dropped.
 *
 * This module is intentionally free of any browser/editor dependency so that the
 * heuristic can be unit-tested in isolation.
 */
export function computeSkillKeywords(skill: IAgentSkill): Set<string> {
	const keywords = new Set<string>();
	const add = (raw: string) => {
		const token = raw.toLowerCase();
		if (token.length >= SKILL_KEYWORD_MIN_LENGTH && !SKILL_KEYWORD_STOPWORDS.has(token)) {
			keywords.add(token);
		}
	};

	// name: split on separators and camelCase
	for (const part of skill.name.split(/[-_\s]+/)) {
		for (const camel of part.split(/(?<=[a-z0-9])(?=[A-Z])/)) {
			if (camel) {
				add(camel);
			}
		}
	}

	// description: tokenize into word characters (unicode aware)
	if (skill.description) {
		for (const token of skill.description.split(/[^\p{L}\p{N}]+/u)) {
			if (token) {
				add(token);
			}
		}
	}

	return keywords;
}
