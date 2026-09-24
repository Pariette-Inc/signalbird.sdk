package signalbird

import "testing"

func TestIdentityHashVector(t *testing.T) {
	c, err := NewClient(Config{DomainKey: "sb_secret_live_example0000000000"})
	if err != nil {
		t.Fatal(err)
	}
	if got := c.IdentityHash("user_42"); got != "b802f38c59cb0f0c9283d6a8091c692c6c70db549acab1083c630426e2916258" {
		t.Fatalf("got %s", got)
	}
}
