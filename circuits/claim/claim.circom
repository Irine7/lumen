pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

template Claim(depth) {
  signal input recipient_secret;
  signal input identity_hash;
  signal input leaf_salt;
  signal input eligibility_merkle_path[depth];
  signal input eligibility_merkle_indices[depth];
  signal input compliance_leaf_salt;
  signal input compliance_merkle_path[depth];
  signal input compliance_merkle_indices[depth];
  signal input amount_salt;

  signal input campaign_id;
  signal input eligibility_root;
  signal input compliance_root;
  signal input policy_hash;
  signal input nullifier_hash;
  signal input amount;
  signal input max_amount;
  signal input amount_commitment;
  signal input recipient_commitment;
  signal input payout_account_hash;

  component leaf_hasher = Poseidon(4);
  leaf_hasher.inputs[0] <== recipient_secret;
  leaf_hasher.inputs[1] <== identity_hash;
  leaf_hasher.inputs[2] <== leaf_salt;
  leaf_hasher.inputs[3] <== policy_hash;

  signal current[depth + 1];
  current[0] <== leaf_hasher.out;

  component path_hashers[depth];
  signal left[depth];
  signal right[depth];
  signal selected_delta[depth];

  for (var i = 0; i < depth; i++) {
    eligibility_merkle_indices[i] * (eligibility_merkle_indices[i] - 1) === 0;

    selected_delta[i] <== eligibility_merkle_indices[i] *
      (eligibility_merkle_path[i] - current[i]);
    left[i] <== current[i] + selected_delta[i];
    right[i] <== eligibility_merkle_path[i] - selected_delta[i];

    path_hashers[i] = Poseidon(2);
    path_hashers[i].inputs[0] <== left[i];
    path_hashers[i].inputs[1] <== right[i];
    current[i + 1] <== path_hashers[i].out;
  }

  current[depth] === eligibility_root;

  component compliance_leaf_hasher = Poseidon(4);
  compliance_leaf_hasher.inputs[0] <== recipient_secret;
  compliance_leaf_hasher.inputs[1] <== identity_hash;
  compliance_leaf_hasher.inputs[2] <== compliance_leaf_salt;
  compliance_leaf_hasher.inputs[3] <== policy_hash;

  signal compliance_current[depth + 1];
  compliance_current[0] <== compliance_leaf_hasher.out;

  component compliance_path_hashers[depth];
  signal compliance_left[depth];
  signal compliance_right[depth];
  signal compliance_selected_delta[depth];

  for (var j = 0; j < depth; j++) {
    compliance_merkle_indices[j] * (compliance_merkle_indices[j] - 1) === 0;

    compliance_selected_delta[j] <== compliance_merkle_indices[j] *
      (compliance_merkle_path[j] - compliance_current[j]);
    compliance_left[j] <== compliance_current[j] + compliance_selected_delta[j];
    compliance_right[j] <== compliance_merkle_path[j] - compliance_selected_delta[j];

    compliance_path_hashers[j] = Poseidon(2);
    compliance_path_hashers[j].inputs[0] <== compliance_left[j];
    compliance_path_hashers[j].inputs[1] <== compliance_right[j];
    compliance_current[j + 1] <== compliance_path_hashers[j].out;
  }

  compliance_current[depth] === compliance_root;

  component nullifier_hasher = Poseidon(2);
  nullifier_hasher.inputs[0] <== recipient_secret;
  nullifier_hasher.inputs[1] <== campaign_id;
  nullifier_hasher.out === nullifier_hash;

  component amount_commitment_hasher = Poseidon(3);
  amount_commitment_hasher.inputs[0] <== amount;
  amount_commitment_hasher.inputs[1] <== amount_salt;
  amount_commitment_hasher.inputs[2] <== campaign_id;
  amount_commitment_hasher.out === amount_commitment;

  component recipient_commitment_hasher = Poseidon(3);
  recipient_commitment_hasher.inputs[0] <== recipient_secret;
  recipient_commitment_hasher.inputs[1] <== policy_hash;
  recipient_commitment_hasher.inputs[2] <== payout_account_hash;
  recipient_commitment_hasher.out === recipient_commitment;

  component cap_check = LessEqThan(64);
  cap_check.in[0] <== amount;
  cap_check.in[1] <== max_amount;
  cap_check.out === 1;
}

component main { public [
  campaign_id,
  eligibility_root,
  compliance_root,
  policy_hash,
  nullifier_hash,
  amount,
  max_amount,
  amount_commitment,
  recipient_commitment,
  payout_account_hash
] } = Claim(3);
