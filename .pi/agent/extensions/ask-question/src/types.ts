export interface OptionWithDesc {
	label: string;
	description?: string;
	isRecommended?: boolean;
}

export type DisplayOption = OptionWithDesc & { isOther?: boolean };

export interface AskQuestionParamsInput {
	question: string;
	options: OptionWithDesc[];
}

export interface AskQuestionDetails {
	question: string;
	options: string[];
	answer: string | null;
	wasCustom?: boolean;
}

export interface AskQuestionResult {
	answer: string;
	wasCustom: boolean;
	index?: number;
}
