import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Qantara } from "../target/types/qantara";

// This file ensures the IDL is loaded before tests run
// Run `anchor build` first to generate the IDL

export function getProgram(provider: anchor.AnchorProvider): Program<Qantara> {
  const program = anchor.workspace.Qantara as Program<Qantara>;
  return program;
}

