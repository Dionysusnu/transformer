import ts from "typescript";
import { Diagnostics } from "../../../../classes/diagnostics";
import { assert } from "../../../../classes/rojoResolver/util/assert";
import { f } from "../../../../util/factory";
import { GenericIdOptions, getGenericIdMap } from "../../../../util/functions/getGenericIdMap";
import { getNodeUid } from "../../../../util/uid";
import { CallMacro } from "../../macro";

function formatOrdinal(num: number) {
	return ["1st", "2nd", "3rd"][num - 1] ?? `${num}th`;
}

function wrapNever(node: ts.Expression, genericInfo: GenericIdOptions) {
	return genericInfo.never ? f.as(node, f.keywordType(ts.SyntaxKind.NeverKeyword)) : node;
}

export const GenericIdMacro: CallMacro = {
	getSymbol(state) {
		return [...getGenericIdMap(state).keys()];
	},

	transform(state, node, { symbol }) {
		const genericInfo = getGenericIdMap(state).get(symbol);
		assert(genericInfo);

		const argument = node.arguments[genericInfo.index];

		if (!node.typeArguments?.[0]) {
			if (!genericInfo.optional && !argument) {
				Diagnostics.error(
					node.expression,
					`This macro requires you to specify a type argument.`,
					`You can also specify the ID (${formatOrdinal(genericInfo.index + 1)} parameter)`,
				);
			}
		} else if (!argument) {
			const id = getNodeUid(state, node.typeArguments[0]);
			const parameters = new Array<ts.Expression>();

			for (let i = 0; i < genericInfo.index; i++) {
				parameters.push(node.arguments[i] ? state.transformNode(node.arguments[i]) : f.nil());
			}

			parameters.push(wrapNever(f.string(id), genericInfo));
			return f.update.call(node, state.transformNode(node.expression), parameters);
		}

		if (genericInfo.convertArgument) {
			const symbol = state.getSymbol(argument);

			if (symbol && state.classes.has(symbol)) {
				const id = getNodeUid(state, argument);
				const parameters = [...node.arguments];
				parameters[genericInfo.index] = wrapNever(f.string(id), genericInfo);

				return f.update.call(node, state.transformNode(node.expression), parameters);
			}
		}

		return state.transform(node);
	},
};
