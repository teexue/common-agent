package provider

import "testing"

func TestCatalogModelRowHasVision(t *testing.T) {
	yes := true
	cases := []struct {
		name string
		row  catalogModelRow
		want bool
	}{
		{name: "plain id", row: catalogModelRow{ID: "gpt-4o"}, want: false},
		{name: "vision true", row: catalogModelRow{Vision: &yes}, want: true},
		{name: "supports_vision", row: catalogModelRow{SupportsVision: &yes}, want: true},
		{
			name: "capabilities vision",
			row:  catalogModelRow{Capabilities: []string{"completion", "vision"}},
			want: true,
		},
		{
			name: "openrouter input_modalities",
			row: catalogModelRow{Architecture: catalogArchitecture{
				InputModalities: []string{"text", "image"},
			}},
			want: true,
		},
		{
			name: "openrouter modality string",
			row: catalogModelRow{Architecture: catalogArchitecture{
				Modality: "text+image->text",
			}},
			want: true,
		},
		{
			name: "text only",
			row: catalogModelRow{Architecture: catalogArchitecture{
				InputModalities: []string{"text"},
				Modality:        "text->text",
			}},
			want: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.row.toModelInfo().Vision
			if got != tc.want {
				t.Fatalf("vision = %v, want %v", got, tc.want)
			}
		})
	}
}
