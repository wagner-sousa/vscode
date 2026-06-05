/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../../../editor/common/core/range.js';
import { withTestCodeEditor } from '../../../../../../../../editor/test/browser/testCodeEditor.js';
import { URI } from '../../../../../../../../base/common/uri.js';
import { IChatWidget } from '../../../../../browser/chat.js';
import { ChatWidget } from '../../../../../browser/widget/chatWidget.js';
import '../../../../../browser/widget/input/editor/chatInputEditorContrib.js';
import { computeSkillKeywords } from '../../../../../browser/widget/input/editor/chatSkillKeywords.js';
import { IAgentSkill, PromptsStorage } from '../../../../../common/promptSyntax/service/promptsService.js';

suite('ChatTokenDeleter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function getChatTokenDeleterCtor() {
		const ctor = ChatWidget.CONTRIBS.find(contrib => contrib.name === 'ChatTokenDeleter');
		assert.ok(ctor, 'ChatTokenDeleter should be registered as a chat widget contribution');
		return ctor;
	}

	function createWidget(editor: IChatWidget['inputEditor'], onRefreshParsedInput: () => void): IChatWidget {
		return {
			inputEditor: editor,
			refreshParsedInput: onRefreshParsedInput,
		} as unknown as IChatWidget;
	}

	test('deletes inserted slash, agent, and variable tokens on immediate backspace', () => {
		const testCases = [
			{ initialValue: '/', insertedText: '/fix ', deleteRange: new Range(1, 5, 1, 6) },
			{ initialValue: '@', insertedText: '@workspace ', deleteRange: new Range(1, 11, 1, 12) },
			{ initialValue: '#', insertedText: '#selection', deleteRange: new Range(1, 10, 1, 11) },
		];

		for (const testCase of testCases) {
			withTestCodeEditor(testCase.initialValue, {}, editor => {
				let refreshCount = 0;
				const store = new DisposableStore();
				try {
					const widget = createWidget(editor, () => {
						refreshCount++;
					});
					const ChatTokenDeleterCtor = getChatTokenDeleterCtor();
					store.add(new ChatTokenDeleterCtor(widget));

					editor.executeEdits('test', [{ range: new Range(1, 1, 1, 2), text: testCase.insertedText }]);
					assert.strictEqual(editor.getValue(), testCase.insertedText);

					editor.executeEdits('test', [{ range: testCase.deleteRange, text: '' }]);
					assert.strictEqual(editor.getValue(), '');
					assert.strictEqual(refreshCount, 1);
				} finally {
					store.dispose();
				}
			});
		}
	});

	test('does not delete the whole token when backspacing inside the inserted token', () => {
		withTestCodeEditor('@', {}, editor => {
			let refreshCount = 0;
			const store = new DisposableStore();
			try {
				const widget = createWidget(editor, () => {
					refreshCount++;
				});
				const ChatTokenDeleterCtor = getChatTokenDeleterCtor();
				store.add(new ChatTokenDeleterCtor(widget));

				editor.executeEdits('test', [{ range: new Range(1, 1, 1, 2), text: '@workspace ' }]);
				editor.executeEdits('test', [{ range: new Range(1, 5, 1, 6), text: '' }]);

				assert.strictEqual(editor.getValue(), '@worspace ');
				assert.strictEqual(refreshCount, 0);
			} finally {
				store.dispose();
			}
		});
	});

	test('only deletes on the immediate next backspace after token insertion', () => {
		withTestCodeEditor('@', {}, editor => {
			let refreshCount = 0;
			const store = new DisposableStore();
			try {
				const widget = createWidget(editor, () => {
					refreshCount++;
				});
				const ChatTokenDeleterCtor = getChatTokenDeleterCtor();
				store.add(new ChatTokenDeleterCtor(widget));

				editor.executeEdits('test', [{ range: new Range(1, 1, 1, 2), text: '@workspace ' }]);
				editor.executeEdits('test', [{ range: new Range(1, 11, 1, 11), text: 'x' }]);
				editor.executeEdits('test', [{ range: new Range(1, 11, 1, 12), text: '' }]);

				assert.strictEqual(editor.getValue(), '@workspace ');
				assert.strictEqual(refreshCount, 0);
			} finally {
				store.dispose();
			}
		});
	});
});

suite('computeSkillKeywords', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function makeSkill(name: string, description?: string): IAgentSkill {
		return {
			uri: URI.parse(`file:///skills/${name}/SKILL.md`),
			storage: PromptsStorage.local,
			name,
			description,
			disableModelInvocation: false,
			userInvocable: true,
		};
	}

	test('splits the name on hyphens, underscores and camelCase', () => {
		assert.deepStrictEqual([...computeSkillKeywords(makeSkill('fix-errors'))].sort(), ['errors', 'fix']);
		assert.deepStrictEqual([...computeSkillKeywords(makeSkill('deep_research'))].sort(), ['deep', 'research']);
		assert.deepStrictEqual([...computeSkillKeywords(makeSkill('fixErrors'))].sort(), ['errors', 'fix']);
	});

	test('tokenizes the description and merges with name keywords', () => {
		const keywords = computeSkillKeywords(makeSkill('fix-errors', 'Repair compilation problems quickly'));
		assert.ok(keywords.has('fix'));
		assert.ok(keywords.has('errors'));
		assert.ok(keywords.has('repair'));
		assert.ok(keywords.has('compilation'));
		assert.ok(keywords.has('problems'));
		assert.ok(keywords.has('quickly'));
	});

	test('drops stopwords and short tokens', () => {
		const keywords = computeSkillKeywords(makeSkill('go', 'The file to use with you'));
		// 'go' is too short; 'the', 'file', 'to', 'use', 'with', 'you' are stopwords/short
		assert.strictEqual(keywords.size, 0);
	});

	test('is case-insensitive and unicode aware', () => {
		const keywords = computeSkillKeywords(makeSkill('Traduções', 'Converte código para Português'));
		assert.ok(keywords.has('traduções'));
		assert.ok(keywords.has('converte'));
		assert.ok(keywords.has('português'));
		// 'código' is not in the stopword list ('codigo' without accent is), so it is kept
		assert.ok(keywords.has('código'));
	});
});
