// Generated from docs/attack-test-results.json (the attack test on Aevum testnet).
// One real on-chain refusal per contract error, linked from the "Try it without a wallet" page.
export const PROOF: Record<string, `0x${string}`> = {
  UnexpectedWallet: "0x0d3066e89ed84d8e1c4c109328f6b3388e680b077f80a4ffd5a47dfe4bd90736",
  NotAgent: "0x09a2489e8182e478b6235f299a9ecd94f3f0c544a7ee085e2026f3f8b3f550d6",
  PerPayeeCapExceeded: "0x8e63bd19bae42e2a13fd2221f7c8de1dc5b358cb73523126c764dc77104af483",
  PerRunCapExceeded: "0xbab66d05f3d3d35bece5c73c7f8fca56b4634b03474660e8569233ca9173b144",
  PeriodCapExceeded: "0xcd456499d1eedd194854cc71ed06e07362b81ed06b9a3261ac4097a74c04b0f8",
  PayeeNotConfirmed: "0x38febd7f62161988d9bf7ff9541d93f09421f3bb4220ff671b958670c8be744c",
  DuplicatePayee: "0xb6d8518d9cc128d310fa87dd3031c66b519afed559cfe52f260888eca7faeb3f",
  EmptyRun: "0xf4af87b2aacec3526953db2d74660e0c90eb77a862c2e6f7d365fafbf3c128ee",
  LengthMismatch: "0xafafbcbe503afd2c352355d7864991fe1389a50bcff9bc6f9306c7fd2a23ea2f",
  ZeroAmount: "0x6f95b5a35dd4e28aa2a2a14f769f31e440a3f5c9b305a8667f146b17abd642c5",
  TooManyPayees: "0x45b911b9b6a22e0331dd175949d4505d539c9e730f41bb9d5d9c2845c580c197",
  ReviewWindowOpen: "0xcbfe2262b136a46307a501370a652363367af1de663cb530769d99d9f8daf026",
  DuplicateRun: "0x591e1485c69620b9f0fd4d4a24462291c0611b02a4a34d93385b0a00d293245e",
  OwnableUnauthorizedAccount: "0xc68af93b7325acff9fb196670bc2bb16d46b6773508dccf0eb2ac047c704c1a6",
  RunNotApproved: "0xfd76d99fe9ee3ed6351a21a07737e9568dfb176860bff84f17ceeab57fb744f1",
  EnforcedPause: "0x0fdc9d88086ef118c41a15d0a4c7a5fe9c68bea6167f5a471086c0dc375d0e6d",
  PolicyExpired: "0x079ab04003c785346a362406f80a047949801bfd2506a230a012529660d7bb79",
  PolicyRevoked: "0x1e5341724d202657544ce7c9d801c75c0e6e9da327df666624f024273cfb3758",
  LineAlreadyPaid: "0x96e1f84ec28e086c2d8176d6d4fb8327574e301abb59a5ba6bf410e95bf60d2c",
  InvalidWorkerSignature: "0xda57cd58c2853a31d7d39412164849c15c19530ba17513ffd509a8d142f650f2",
};

/** A real PayWarden payment on Aevum: $0.50 to Ada from the demo vault. */
export const PAID_TX = "0x3f9c88f12399a2da3a890525847fc136db45160816e57036bda76527065a0318" as const;
