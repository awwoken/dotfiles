import { Type } from "typebox";

export const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
	isRecommended: Type.Optional(
		Type.Boolean({ description: "Whether this option should be visually marked as recommended. Set this to true for exactly one suggested option." }),
	),
});

export const AskQuestionParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, {
		description: "Suggested options for the user to choose from. The UI always also lets the user type a free-form answer. Exactly one suggested option should set isRecommended: true.",
	}),
});
